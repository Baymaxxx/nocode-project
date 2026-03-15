/**
 * 构建完整货号
 * 例: prefix=TH5660, suffix=0115 => 56600115
 * 提取 prefix 中的数字部分拼接 suffix
 */
export function buildArticleCode(prefix, suffix) {
  const numericPart = prefix.replace(/^[A-Za-z]+/, '');
  return numericPart + suffix;
}

/**
 * 将意大利格式数字字符串转换为标准浮点数
 * 意大利格式: 1.234,56 => 1234.56
 * 简单格式:   89,90   => 89.90
 */
export function parseItalianNumber(str) {
  if (!str) return 0;
  // 如果同时有点和逗号，点为千位分隔符，逗号为小数点
  const cleaned = str.trim()
    .replace(/\./g, '')   // 去掉千位分隔符
    .replace(',', '.');   // 逗号换成小数点
  return parseFloat(cleaned) || 0;
}
