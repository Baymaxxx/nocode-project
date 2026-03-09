import { buildArticleCode, parseItalianNumber } from './invoiceUtils';
import { extractTextFromPdfBytes } from './pdfRawParser';

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 规范化OCR可能出现的混淆字符
 * O->0, I/l->1（仅在纯数字上下文中）
 */
function normalizeOcrToken(token) {
  // 如果token全是 数字+OoIl 组合，做替换
  if (/^[0-9OoIlL|]+$/.test(token)) {
    return token.replace(/[Oo]/g, '0').replace(/[IlL|]/g, '1');
  }
  return token;
}

/**
 * 从行中提取数字列表（支持OCR混淆字符修正）
 */
function extractNumbers(str) {
  // 先做全局替换：把可能是数字的token规范化
  const normalized = str.replace(/\b([0-9OoIlL|,\.]+)\b/g, (m) => normalizeOcrToken(m));
  return normalized.match(/\d+(?:[,.]\d+)?/g) || [];
}

/**
 * 判断一行是否是TGL行（支持OCR误识别变体）
 */
function isTglLine(line) {
  return /\b(TGL|TG[L1lI|])\b/i.test(line) || /^TG[L1lI|]/i.test(line);
}

/**
 * 判断一行是否是QTA行（支持OCR误识别变体）
 */
function isQtaLine(line) {
  return /\b(QTA|QT[A4Aa@])\b/i.test(line) || /^QT[A4Aa@]/i.test(line);
}

/**
 * 解析CRISPI Invoice格式
 * 每个商品由3行组成：
 * 1. 商品行: 货号前缀(如TH5660) 后缀(如0115) 描述 单价
 * 2. TGL行: TGL 37 38 39 40 41
 * 3. QTA行: QTA  2  3  4  3  2
 */
function parseInvoiceLines(lines) {
  const results = [];

  console.log('=== 开始解析，共', lines.length, '行 ===');
  lines.forEach((l, i) => console.log(`[${i}] ${l}`));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 规范化当前行的OCR混淆
    const normLine = line.replace(/\b([A-Z]{1,3})([0-9OoIl|]{3,6})\s+([0-9OoIl|]{4})\b/g, (m, p1, p2, p3) => {
      return p1 + p2.replace(/[Oo]/g, '0').replace(/[IlL|]/g, '1')
           + ' ' + p3.replace(/[Oo]/g, '0').replace(/[IlL|]/g, '1');
    });

    // 匹配货号格式：字母前缀+数字(如TH5660) 空格 4位后缀(如0115)
    const articleMatch =
      normLine.match(/\b([A-Z]{1,3})(\d{3,6})\s+(\d{4})\b/) ||
      normLine.match(/\b([A-Z]{1,3})(\d{3,6})(\d{4})\b/);

    if (!articleMatch) continue;

    const prefixLetters = articleMatch[1];
    const prefixNums = articleMatch[2];
    const suffix = articleMatch[3];
    const articleCode = buildArticleCode(prefixLetters + prefixNums, suffix);

    // 提取单价（意大利格式）
    const priceMatch = normLine.match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*€?\s*$/) ||
                       normLine.match(/(\d{1,3}(?:\.\d{3})*[,.]\d{2})\s*€?\s*$/);
    const price = priceMatch ? parseItalianNumber(priceMatch[1]) : 0;

    // 提取描述
    let description = normLine
      .replace(articleMatch[0], '')
      .replace(priceMatch ? priceMatch[0] : '', '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!description) description = articleCode;

    // 向后查找TGL行和QTA行（最多12行内）
    let tglLine = '', qtaLine = '';
    let qtaIdx = -1;

    for (let j = i + 1; j < Math.min(i + 14, lines.length); j++) {
      const ln = lines[j];
      if (!tglLine && isTglLine(ln)) tglLine = ln;
      if (!qtaLine && isQtaLine(ln)) { qtaLine = ln; qtaIdx = j; }
      if (tglLine && qtaLine) break;
    }

    if (!tglLine || !qtaLine) {
      console.log(`[${i}] 货号 ${articleCode} 未找到TGL/QTA行，跳过`);
      continue;
    }

    console.log(`货号 ${articleCode}: TGL="${tglLine}" QTA="${qtaLine}"`);

    // 提取尺码和数量（带OCR修正）
    const sizes = extractNumbers(tglLine.replace(/\b(TGL|TG[L1lI|])\b/gi, '').trim());
    const qtys = extractNumbers(qtaLine.replace(/\b(QTA|QT[A4Aa@])\b/gi, '').trim());

    console.log(`  尺码: ${sizes.join(', ')}`);
    console.log(`  数量: ${qtys.join(', ')}`);

    const len = Math.min(sizes.length, qtys.length);
    if (len === 0) {
      console.log(`  警告：尺码或数量为空`);
      continue;
    }

    for (let k = 0; k < len; k++) {
      const qty = parseFloat(qtys[k].replace(',', '.'));
      if (qty > 0) {
        results.push({
          articleCode,
          description,
          size: sizes[k],
          qty: String(qty),
          price: price > 0 ? price.toFixed(2) : '0.00',
        });
      }
    }

    if (qtaIdx > 0) i = qtaIdx;
  }

  console.log('=== 解析完成，找到', results.length, '条记录 ===');
  return results;
}

/**
 * 主入口：解析CRISPI Invoice PDF
 */
export async function parsePdfInvoice(file, onProgress) {
  let buffer;
  try {
    buffer = await readFileAsArrayBuffer(file);
  } catch (e) {
    throw new Error('文件读取失败：' + e.message);
  }

  let lines;
  try {
    lines = await extractTextFromPdfBytes(buffer, onProgress);
  } catch (e) {
    throw new Error('PDF解析失败：' + e.message);
  }

  if (!lines || lines.length === 0) {
    throw new Error('未能从PDF中提取到文本内容');
  }

  const rawText = lines.join('\n');
  const data = parseInvoiceLines(lines);

  return { data, rawText };
}
