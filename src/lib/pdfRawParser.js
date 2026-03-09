/**
 * 纯原生 PDF 文本提取器
 * 不依赖任何第三方 PDF 库，直接解析 PDF 字节流中的文本内容
 */

/**
 * 解码 PDF 文本流中的字符串
 */
function decodePdfString(str) {
  // 处理十六进制编码 <hex>
  if (str.startsWith('<') && str.endsWith('>')) {
    const hex = str.slice(1, -1);
    let result = '';
    for (let i = 0; i < hex.length; i += 2) {
      result += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return result;
  }
  // 处理转义字符
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/**
 * 从 PDF 字节数组中提取所有文本内容
 */
export function extractTextFromPdfBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  // 将字节转换为 Latin-1 字符串（保留所有字节值）
  let content = '';
  for (let i = 0; i < bytes.length; i++) {
    content += String.fromCharCode(bytes[i]);
  }

  const lines = [];

  // 提取所有 BT...ET 文本块
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let match;

  while ((match = btEtRegex.exec(content)) !== null) {
    const block = match[1];

    // 提取括号字符串 (text)
    const parenRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|TJ|'|")/g;
    let textMatch;
    const blockTexts = [];

    while ((textMatch = parenRegex.exec(block)) !== null) {
      const decoded = decodePdfString(textMatch[1]);
      const cleaned = decoded.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '').trim();
      if (cleaned) blockTexts.push(cleaned);
    }

    // 提取数组格式 [(text) ... ] TJ
    const arrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let arrayMatch;
    while ((arrayMatch = arrayRegex.exec(block)) !== null) {
      const arrayContent = arrayMatch[1];
      const innerParenRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let innerMatch;
      const parts = [];
      while ((innerMatch = innerParenRegex.exec(arrayContent)) !== null) {
        const decoded = decodePdfString(innerMatch[1]);
        const cleaned = decoded.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '').trim();
        if (cleaned) parts.push(cleaned);
      }
      if (parts.length > 0) blockTexts.push(parts.join(' '));
    }

    if (blockTexts.length > 0) {
      lines.push(blockTexts.join(' ').trim());
    }
  }

  // 同时尝试提取流中的字符串对象（用于某些 PDF 格式）
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  while ((match = streamRegex.exec(content)) !== null) {
    const streamContent = match[1];
    if (streamContent.includes('BT') || streamContent.includes('Tj')) continue; // 已处理
    // 提取可打印 ASCII 文本段
    const textSegments = streamContent.match(/[A-Za-z0-9\s\-\/.,:;()€%#+*]{6,}/g) || [];
    for (const seg of textSegments) {
      const cleaned = seg.trim();
      if (cleaned.length > 5) lines.push(cleaned);
    }
  }

  return lines.filter(Boolean);
}
