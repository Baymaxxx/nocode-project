import * as XLSX from 'xlsx';

/**
 * 从8位货号提取4微编码（前4位数字），返回数字类型
 */
function get4Wei(articleCode) {
  const num = articleCode.replace(/\D/g, '');
  return Number(num.substring(0, 4));
}

/**
 * 从8位货号提取颜色编号（后4位，前面加8）
 */
function getColorCode(articleCode) {
  const num = articleCode.replace(/\D/g, '');
  return '8' + num.substring(4);
}

/**
 * 报关用名称映射（去掉颜色后缀）
 */
function getCustomsName(description) {
  const map = {
    'MONACO LOW GTX': 'MONACO LOW GTX',
    'MONACO LEEDS GTX': 'MONACO LEEDS GTX',
    'MONACO GTX': 'MONACO GTX',
    'MONACO/TINN GTX': 'MONACO/TINN GTX',
    'MONACO TINN GTX': 'MONACO/TINN GTX',
    'MONACO PREMIUM': 'MONACO PREMIUM GTX',
    'MONACO PREMIUM URBN GTX': 'MONACO PREMIUM GTX',
    'PERFETTA GTX': 'PERFETTA GTX',
  };
  const upper = (description || '').toUpperCase();
  for (const [key, val] of Object.entries(map)) {
    if (upper.includes(key)) return val;
  }
  return description || '';
}

/**
 * 将解析数据导出为 Excel 文件（3个sheet，匹配参考格式）
 * @param {Array} data - 解析后的商品数据（来自API，每条含 articleCode, description, qty, price, size）
 * @param {string} sourceFileName - 原始文件名
 */
export function exportToExcel(data, sourceFileName = 'invoice') {
  const wb = XLSX.utils.book_new();

  // ========== 明细表（对应参考的第3个sheet） ==========
  const detailHeaders = ['货号', '4微', '报关用', '货品名称', '颜色编号', '内长', '尺码', '数量', '单价', '折后单价', '含运费单价', '总价', '含运费总价'];
  const detailData = [detailHeaders];

  let detailRowIndex = 2; // 数据从第2行开始（1-indexed，第1行是header）

  data.forEach(item => {
    const articleCode = item.articleCode;
    const customsName = getCustomsName(item.description);
    const size = item.size === '-' ? '' : item.size;
    const qty = Number(item.qty);
    const price = Number(item.price);

    // 4微和颜色编号直接计算好写入，避免公式依赖链问题
    const num = articleCode.replace(/\D/g, '');
    const wei4Val = Number(num.substring(0, 4));
    const colorCode = '8' + num.substring(4);

    detailData.push([
      articleCode,        // 货号：每行都填入
      wei4Val,            // 4微：直接写数字值
      customsName,
      item.description,   // 货品名称：完整品名（含颜色）
      colorCode,    // 颜色编号：直接写值
      0,            // 内长
      size ? Number(size) : '',
      qty,
      price,
      { f: `I${detailRowIndex}*0.97` },                        // 折后单价
      { f: `J${detailRowIndex}` },                              // 含运费单价
      { f: `H${detailRowIndex}*J${detailRowIndex}` },           // 总价
      { f: `K${detailRowIndex}*H${detailRowIndex}` },           // 含运费总价
    ]);
    detailRowIndex++;
  });

  const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
  wsDetail['!cols'] = [
    { wch: 12 },  // 货号
    { wch: 6 },   // 4微
    { wch: 22 },  // 报关用
    { wch: 30 },  // 货品名称
    { wch: 10 },  // 颜色编号
    { wch: 6 },   // 内长
    { wch: 6 },   // 尺码
    { wch: 6 },   // 数量
    { wch: 8 },   // 单价
    { wch: 10 },  // 折后单价
    { wch: 12 },  // 含运费单价
    { wch: 12 },  // 总价
    { wch: 12 },  // 含运费总价
  ];

  // ========== 按4微分组汇总 ==========
  const groupMap = new Map();
  data.forEach(item => {
    const wei4 = get4Wei(item.articleCode);
    const customsName = getCustomsName(item.description);
    const price = Number(item.price);
    const discountPrice = Math.round(price * 0.97 * 10000) / 10000;
    const qty = Number(item.qty);

    if (!groupMap.has(wei4)) {
      groupMap.set(wei4, { wei4, customsName, totalQty: 0, totalDiscountAmount: 0 });
    }
    const g = groupMap.get(wei4);
    g.totalQty += qty;
    g.totalDiscountAmount += qty * discountPrice;
  });

  // 计算每组的加权平均折后单价
  for (const [, g] of groupMap) {
    g.discountPrice = Math.round((g.totalDiscountAmount / g.totalQty) * 1000) / 1000;
  }

  const groups = Array.from(groupMap.values());
  const groupCount = groups.length;

  // ========== Sheet1: 汇总表（简版） ==========
  // 数据行：第2行到第(groupCount+1)行
  const summaryHeaders = ['4微', '折后单价', '报关用', '求和项:数量', '求和项:总价'];
  const summaryData = [summaryHeaders];

  groups.forEach(g => {
    const total = Math.round(g.totalDiscountAmount * 100) / 100;
    summaryData.push([
      g.wei4,           // 数字类型
      g.discountPrice,
      g.customsName,
      g.totalQty,
      total,
    ]);
  });

  // 总计行带 SUM 公式
  const s1LastDataRow = groupCount + 1;
  summaryData.push([
    '总计',
    '',
    '',
    { f: `SUM(D2:D${s1LastDataRow})` },
    { f: `SUM(E2:E${s1LastDataRow})` },
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [
    { wch: 8 },   // 4微
    { wch: 10 },  // 折后单价
    { wch: 22 },  // 报关用
    { wch: 12 },  // 数量
    { wch: 14 },  // 总价
  ];

  // ========== Sheet3: 汇总表（含运费版） ==========
  // 第1行空行，第2行 header，数据从第3行开始
  // 正确文件有13列（含最后一列含运费总价）
  const sheet3Data = [
    ['', '', '', '', '', '', '', '', '', '', '', '', ''],  // 空行（13列）
    ['4微', '折后单价', '报关用', '求和项:数量', '求和项:总价', '', '货号', '报关用', '折后单价', '求和项:数量', '求和项:总价', '含运费单价', ''],
  ];

  const s3DataStartRow = 3;
  groups.forEach((g, idx) => {
    const total = Math.round(g.totalDiscountAmount * 100) / 100;
    const rowNum = s3DataStartRow + idx;
    sheet3Data.push([
      g.wei4,           // 数字类型
      g.discountPrice,
      g.customsName,
      g.totalQty,
      total,
      '',               // 空列分隔
      g.wei4,           // 数字类型
      g.customsName,
      g.discountPrice,
      g.totalQty,
      { f: `I${rowNum}*J${rowNum}` },       // 求和项:总价
      { f: `I${rowNum}+0.11` },             // 含运费单价
      { f: `L${rowNum}*J${rowNum}` },       // 含运费总价
    ]);
  });

  // 汇总行带 SUM 公式
  const s3LastDataRow = s3DataStartRow + groupCount - 1;
  sheet3Data.push([
    '总计', '', '',
    { f: `SUM(D${s3DataStartRow}:D${s3LastDataRow})` },
    { f: `SUM(E${s3DataStartRow}:E${s3LastDataRow})` },
    '', '',
    '总计', '',
    { f: `SUM(J${s3DataStartRow}:J${s3LastDataRow})` },
    { f: `SUM(K${s3DataStartRow}:K${s3LastDataRow})` },
    '',
    { f: `SUM(M${s3DataStartRow}:M${s3LastDataRow})` },
  ]);

  // 运费行
  sheet3Data.push([
    '', '', '', '', '', '', '', '', '', '运费', '', '', '',
  ]);

  // 空行
  sheet3Data.push(['', '', '', '', '', '', '', '', '', '', '', '', '']);
  sheet3Data.push(['', '', '', '', '', '', '', '', '', '', '', '', '']);

  // 最终总计行（左侧第5列显示总金额）
  const grandTotal = Math.round(groups.reduce((sum, g) => sum + g.totalDiscountAmount, 0) * 100) / 100;
  sheet3Data.push([
    '', '', '', '', grandTotal,
    '', '', '', '', '', '', '', '',
  ]);

  const wsSheet3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  wsSheet3['!cols'] = [
    { wch: 8 },   // 4微
    { wch: 10 },  // 折后单价
    { wch: 22 },  // 报关用
    { wch: 12 },  // 求和项:数量
    { wch: 14 },  // 求和项:总价
    { wch: 2 },   // 分隔
    { wch: 8 },   // 货号
    { wch: 22 },  // 报关用
    { wch: 10 },  // 折后单价
    { wch: 12 },  // 求和项:数量
    { wch: 14 },  // 求和项:总价
    { wch: 12 },  // 含运费单价
    { wch: 14 },  // 含运费总价
  ];

  // 添加 sheets 到 workbook（顺序与参考一致：Sheet3, Sheet1, 明细表）
  const baseName = sourceFileName.replace(/\.pdf$/i, '').replace(/^[\d\-_\s]+/, '');
  const detailSheetName = baseName || '采购明细';

  XLSX.utils.book_append_sheet(wb, wsSheet3, 'Sheet3');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Sheet1');
  XLSX.utils.book_append_sheet(wb, wsDetail, detailSheetName);

  const outputName = sourceFileName.replace(/\.pdf$/i, '');
  XLSX.writeFile(wb, `采购单${outputName}.xlsx`);
}
