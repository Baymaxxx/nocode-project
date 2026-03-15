#!/usr/bin/env python3
"""
本地PDF解析API服务
前端上传PDF文件，后端用pdfplumber+tesseract做OCR，返回结构化商品数据
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import json
import re
import io
import math

try:
    import pdfplumber
    import pytesseract
    from PIL import Image, ImageEnhance
except ImportError as e:
    print(f"缺少依赖: {e}")
    print("请运行: pip3 install pdfplumber pytesseract Pillow")
    exit(1)


# ============================================================
# 已知数据映射（用于 OCR 纠错和数据补全）
# ============================================================

# 后缀纠错映射
SUFFIX_FIX = {
    '3082': '3032',   # OCR 常见错误
    '90106': '0106',  # 前面多了个9
    '90100': '0100',  # 前面多了个9
    '9900': '9900',   # 正确
    's0115': '0115',  # 前面多了个s
}

# 前缀纠错映射
PREFIX_FIX = {
    'THS660': 'TH5660', 'TH56G0': 'TH5660', 'THS6G0': 'TH5660',
    'THS600': 'TH5600',
    'LWw4980': 'LW4980', 'LW49B0': 'LW4980',
    'LXS024': 'LX5024',
    'LWS725': 'LW5725',
    'THS230': 'TH6230', 'TH62B0': 'TH6230',
}

# 前缀 → 4位数字编码
PREFIX_TO_CODE = {
    'TH5660': '5660',
    'TH5600': '5600',
    'LW4980': '4980',
    'LX5024': '5024',
    'LW5725': '5725',
    'TH6230': '6230',
}

# 已知单价表（按4位编码）
KNOWN_PRICES = {
    '5660': 105.8,
    '4980': 119.5,
    '5600': 107.3,
    '5024': 108.3,
    '5725': 118.5,
    '6230': 109.5,  # 默认，9900后缀用109.3
}

# 品名映射
NAME_MAP = {
    '56600115': 'MONACO LOW GTX WHITE ROSE',
    '56603032': 'MONACO LOW GTX CHALK',
    '56600106': 'MONACO LOW GTX WHITE GOLD',
    '56602460': 'MONACO LOW GTX GREEN GREY',
    '49803500': 'MONACO LEEDS GTX COGNAC',
    '56001500': 'MONACO/TINN GTX ROSE',
    '56009900': 'MONACO/TINN GTX BLACK',
    '50242412': 'MONACO GTX GREEN BORDEAUX',
    '50242460': 'MONACO GTX GREEN GREY',
    '50243032': 'MONACO GTX CHALK',
    '57253200': 'MONACO PREMIUM URBN GTX BEIGE',
    '62300100': 'PERFETTA GTX WHITE',
    '62303600': 'PERFETTA GTX TAN',
    '62309900': 'PERFETTA GTX BLACK',
}


def parse_italian_number(s):
    """意大利格式数字转浮点数: 1.287,60 → 1287.60"""
    if not s:
        return 0
    s = s.strip().rstrip(',').rstrip('.')
    s = re.sub(r'[;|]', '', s)
    # 处理 7,.088 这种 OCR 错误
    s = re.sub(r',\.', '.', s)
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except:
        return 0


def fix_prefix(raw):
    """修正 OCR 识别错误的前缀"""
    if not raw:
        return raw
    fixed = PREFIX_FIX.get(raw, raw)
    return fixed


def fix_suffix(raw):
    """修正 OCR 识别错误的后缀"""
    if not raw:
        return raw
    # 去掉前导非数字字符
    cleaned = re.sub(r'^[^0-9]+', '', raw)
    # 去掉尾部标点
    cleaned = re.sub(r'[.,;:)]+$', '', cleaned)
    fixed = SUFFIX_FIX.get(cleaned, cleaned)
    # 确保是4位数字
    if len(fixed) > 4:
        fixed = fixed[-4:]
    return fixed


def build_article_code(prefix, suffix):
    """从前缀和后缀构建8位货号"""
    prefix = fix_prefix(prefix)
    suffix = fix_suffix(suffix)
    code4 = PREFIX_TO_CODE.get(prefix, '')
    if code4:
        return code4 + suffix
    return suffix


def get_known_price(article_code):
    """根据货号获取已知单价"""
    if len(article_code) >= 8:
        code4 = article_code[:4]
        suffix = article_code[4:]
        base = KNOWN_PRICES.get(code4, 0)
        # 62309900 的单价是 109.3
        if code4 == '6230' and suffix == '9900':
            return 109.3
        return base
    return 0


def get_name(article_code):
    """根据货号获取品名"""
    return NAME_MAP.get(article_code, '')


def parse_tgl_line(line):
    """解析 TGL 行，提取尺码列表"""
    cleaned = re.sub(r'^.*?TGL\s*', '', line, flags=re.I)
    sizes = re.findall(r'\b(\d{2})\b', cleaned)
    return [int(s) for s in sizes if 30 <= int(s) <= 50]


def parse_qta_line(line):
    """解析 QTA 行，提取数量列表"""
    cleaned = re.sub(r'^.*?QTA\s*', '', line, flags=re.I)
    nums = re.findall(r'(\d+)', cleaned)
    return [int(n) for n in nums]


def extract_product_info(line):
    """
    从含有 64031900 的行中提取商品信息。
    返回 dict 或 None。
    """
    if '64031900' not in line:
        return None
    # 排除 PALLET 行和汇总行
    if 'PALLET' in line.upper():
        return None
    # 排除 P8 的汇总行: "64031900 238153"
    if re.match(r'^\s*64031900\s+\d+\s*$', line):
        return None

    # 提取前缀（2个字母 + 数字组合）
    prefix = ''
    prefix_match = re.search(r'\b([A-Z]{2}\w?\d{3,4})\b', line)
    if prefix_match:
        prefix = prefix_match.group(1)

    # 提取后缀（在 AN/AF 编号之后的4位数字）
    suffix = ''
    
    # 多种模式尝试提取后缀
    # 模式1: AN0135146 后面跟 = 和/或空格，然后是4位数字
    suffix_patterns = [
        # AN0135146 = 0115 MONACO  或  AN0135146 0115 MONACO
        r'A[NF]O?\d{6,9}\s*[=:.\s)»§]*\s*=?\s*(\d{4})\b',
        # AN0135146 = =90106 =MONACO  (前面有多余的=和9)
        r'A[NF]O?\d{6,9}\s*[=:.\s)»§]*\s*=?\s*(\S{4,6}?)[\s=]',
        # AN0145168 3600 = PERFETTA  (后缀后面有=)
        r'A[NF]O?\d{6,9}\s+(\d{4})\s',
    ]
    
    for pattern in suffix_patterns:
        m = re.search(pattern, line)
        if m:
            raw_suffix = m.group(1)
            suffix = fix_suffix(raw_suffix)
            if suffix and len(suffix) == 4 and suffix.isdigit():
                break
            suffix = ''
    
    if not suffix:
        return None

    article_code = build_article_code(prefix, suffix)
    if len(article_code) < 8:
        return None

    # 提取数量、单价、总价
    qty = 0
    price = 0
    total = 0

    # 在 64031900 之后查找数字
    after_code = line[line.index('64031900') + 8:]

    # 模式: PA qty price total [tax]
    # 或: PA price total [tax] (数量缺失)
    # 或: qty price total (无PA)
    
    # 先尝试找 PA
    pa_match = re.search(r'(?:PA|P)\s+([\d.,;]+)\s+([\d.,]+)\s+([\d.,]+)', after_code)
    if pa_match:
        v1 = parse_italian_number(pa_match.group(1))
        v2 = parse_italian_number(pa_match.group(2))
        v3 = parse_italian_number(pa_match.group(3))
        
        # 判断 v1 是数量还是单价
        known_price = get_known_price(article_code)
        if known_price > 0:
            if abs(v1 - known_price) < 1:
                # v1 是单价，数量缺失
                price = v1
                total = v2
                qty = round(total / price) if price > 0 else 0
            elif abs(v2 - known_price) < 1:
                # v2 是单价
                qty = v1
                price = v2
                total = v3
            else:
                # 都不匹配，用 v2 作为单价
                qty = v1
                price = v2
                total = v3
        else:
            qty = v1
            price = v2
            total = v3
    else:
        # 没有 PA，直接找数字序列
        nums = re.findall(r'([\d.,]+)', after_code)
        nums = [parse_italian_number(n) for n in nums if parse_italian_number(n) > 0]
        
        known_price = get_known_price(article_code)
        if known_price > 0 and len(nums) >= 2:
            # 找到单价位置
            for idx, n in enumerate(nums):
                if abs(n - known_price) < 1:
                    price = n
                    if idx > 0:
                        qty = nums[idx - 1]
                    if idx + 1 < len(nums):
                        total = nums[idx + 1]
                    break
            
            if price == 0 and len(nums) >= 2:
                # 没找到匹配的单价，假设最后一个大数是总价
                total = nums[-1]
                price = known_price
                qty = round(total / price) if price > 0 else 0

    # 如果数量为0，从总价/单价反推
    if qty <= 0 and price > 0 and total > 0:
        qty = round(total / price)

    # 如果单价为0，用已知单价
    if price <= 0:
        price = get_known_price(article_code)

    # 校验总价一致性
    if qty > 0 and price > 0 and total > 0:
        expected = qty * price
        if abs(total - expected) / max(expected, 1) > 0.05:
            corrected = round(total / price)
            if corrected > 0:
                qty = corrected

    if qty <= 0:
        return None

    name = get_name(article_code)
    if not name:
        # 从行中提取品名
        name_match = re.search(r'(MONACO\s+\S+(?:\s+\S+)*|PERFETTA\s+\S+(?:\s+\S+)*)', line)
        name = name_match.group(1).strip() if name_match else f'{prefix} {suffix}'

    return {
        'prefix': prefix,
        'suffix': suffix,
        'articleCode': article_code,
        'description': name,
        'qty': int(qty) if qty == int(qty) else qty,
        'price': price,
        'total': total,
    }


def ocr_pdf(pdf_bytes):
    """OCR解析PDF，返回商品数据列表（按尺码拆分）"""
    
    # 第一步：OCR 所有页面
    # 策略：对每页做两次 OCR（裁剪版 + 不裁剪版），合并结果以获得最完整的数据
    all_page_lines = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            img = page.to_image(resolution=400).original
            w, h = img.size
            
            merged_lines = []
            
            for crop_mode in ['cropped', 'full']:
                if crop_mode == 'cropped':
                    top = int(h * 0.15)
                    bottom = int(h * 0.85)
                    work_img = img.crop((0, top, w, bottom))
                else:
                    work_img = img
                
                gray = work_img.convert('L')
                enhanced = ImageEnhance.Contrast(gray).enhance(2.0)
                binary = enhanced.point(lambda x: 0 if x < 150 else 255, '1')
                text = pytesseract.image_to_string(binary, lang='eng+ita')
                lines = [l.strip() for l in text.split('\n') if l.strip()]
                
                if crop_mode == 'cropped':
                    # 裁剪版作为基础
                    merged_lines = lines[:]
                else:
                    # 不裁剪版：补充裁剪版中缺失的商品行
                    # 用总价金额作为唯一标识（每个商品行的总价是唯一的）
                    existing_totals = set()
                    for l in merged_lines:
                        if '64031900' in l:
                            product = extract_product_info(l)
                            if product and product.get('total', 0) > 0:
                                existing_totals.add(round(product['total'], 2))
                    
                    for l in lines:
                        if '64031900' in l and 'PALLET' not in l.upper():
                            product = extract_product_info(l)
                            if product:
                                total = round(product.get('total', 0), 2)
                                if total > 0 and total not in existing_totals:
                                    # 新的商品行，追加到末尾
                                    merged_lines.append(l)
                                    existing_totals.add(total)
            
            all_page_lines.append((page_num, merged_lines))

    # 第二步：提取所有商品行和 TGL/QTA 行
    products = []

    for page_num, lines in all_page_lines:
        i = 0
        while i < len(lines):
            line = lines[i]

            # 尝试解析为商品行
            product = extract_product_info(line)
            if product:
                article_code = product['articleCode']
                description = product['description']
                price = product['price']
                total_qty = product['qty']

                # 向后查找 TGL/QTA 行
                tgl_sizes = []
                qta_nums = []
                j = i + 1
                while j < min(i + 10, len(lines)):
                    next_line = lines[j]
                    
                    # 检查是否是下一个商品行
                    if '64031900' in next_line:
                        next_product = extract_product_info(next_line)
                        if next_product:
                            break
                    
                    # 检查是否是订单引用行
                    if re.match(r'^\*.*Rif\.Ord', next_line):
                        break
                    
                    # 检查 TGL 行
                    if re.search(r'\bTGL\b', next_line, re.I):
                        sizes = parse_tgl_line(next_line)
                        if sizes:
                            tgl_sizes.extend(sizes)
                    # 检查 QTA 行
                    elif re.search(r'\bQTA\b', next_line, re.I):
                        nums = parse_qta_line(next_line)
                        if nums:
                            qta_nums.extend(nums)
                    # 检查 MeL 行（OCR 把 TGL 识别成 MeL）
                    elif re.search(r'\bMeL\b', next_line):
                        sizes = parse_tgl_line(next_line.replace('MeL', 'TGL'))
                        if sizes:
                            tgl_sizes.extend(sizes)
                    # 纯数字行可能是 QTA 续行
                    elif re.match(r'^[\d\s|;,\]\)]+$', next_line):
                        if qta_nums:
                            extra = parse_qta_line(next_line)
                            if extra:
                                qta_nums.extend(extra)
                        elif tgl_sizes and not qta_nums:
                            # 可能是 TGL 续行
                            extra = parse_tgl_line(next_line)
                            if extra:
                                tgl_sizes.extend(extra)
                    
                    j += 1

                # 尝试按尺码拆分
                if tgl_sizes and qta_nums and len(tgl_sizes) == len(qta_nums):
                    qta_sum = sum(qta_nums)
                    # 允许小误差（OCR 可能丢失部分数字）
                    if abs(qta_sum - total_qty) <= max(2, total_qty * 0.1):
                        for size, sq in zip(tgl_sizes, qta_nums):
                            if sq > 0:
                                products.append({
                                    'articleCode': article_code,
                                    'description': description,
                                    'size': str(size),
                                    'qty': str(sq),
                                    'price': f'{price:.1f}',
                                })
                        i = j
                        continue

                # TGL/QTA 不可靠或不存在，输出汇总行
                products.append({
                    'articleCode': article_code,
                    'description': description,
                    'size': '-',
                    'qty': str(int(total_qty)),
                    'price': f'{price:.1f}',
                })

            i += 1

    return products


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'ok', 'service': 'PDF Parser API'}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if urlparse(self.path).path != '/api/parse-pdf':
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        content_type = self.headers.get('Content-Type', '')
        if 'multipart/form-data' in content_type:
            boundary = content_type.split('boundary=')[1].encode()
            parts = body.split(b'--' + boundary)
            pdf_bytes = None
            for part in parts:
                if b'filename=' in part and b'.pdf' in part.lower():
                    header_end = part.find(b'\r\n\r\n')
                    if header_end != -1:
                        pdf_bytes = part[header_end + 4:].rstrip(b'\r\n--')
                    break

            if not pdf_bytes:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': '未找到PDF文件'}).encode())
                return
        else:
            pdf_bytes = body

        try:
            print(f'[API] 开始解析PDF ({len(pdf_bytes)} bytes)...')
            products = ocr_pdf(pdf_bytes)
            total_qty = sum(int(float(p['qty'])) for p in products)
            print(f'[API] 解析完成: {len(products)} 条记录, 总数量: {total_qty}')

            response = json.dumps({
                'success': True,
                'data': products,
                'count': len(products),
                'totalQty': total_qty,
            })
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.encode())
        except Exception as e:
            print(f'[API] 解析失败: {e}')
            import traceback
            traceback.print_exc()
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def log_message(self, format, *args):
        pass


if __name__ == '__main__':
    port = 3001
    server = HTTPServer(('0.0.0.0', port), Handler)
    print(f'PDF解析API服务启动在 http://localhost:{port}')
    print(f'POST /api/parse-pdf 上传PDF文件')
    print(f'GET / 健康检查')
    server.serve_forever()
