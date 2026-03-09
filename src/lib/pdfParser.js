import { buildArticleCode, parseItalianNumber } from './invoiceUtils';
import { extractTextFromPdfBytes } from './pdfRawParser';

/**
 * 读取文件为 ArrayBuffer
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 读取文件为文本（备用方案）
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'latin1');
  });
}

/**
 * 从文本内容中提取所有 BT...ET 文本块
 */
function extractLinesFromText(content) {
  const lines = [];

  // 提取 BT...ET 块
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(content)) !== null) {
    const block = match[1];
    const texts = [];

    // 括号字符串
    const parenRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|TJ|'|")/g;
    let m;
    while ((m = parenRegex.exec(block)) !== null) {
      const t = m[1].replace(/\\[nrt\\()]/g, ' ').replace(/[^\x20-\x7E]/g, '').trim();
      if (t) texts.push(t);
    }

    // 数组格式
    const arrRegex = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = arrRegex.exec(block)) !== null) {
      const parts = [];
      const inner = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let im;
      while ((im = inner.exec(m[1])) !== null) {
        const t = im[1].replace(/\\[nrt\\()]/g, ' ').replace(/[^\x20-\x7E]/g, '').trim();
        if (t) parts.push(t);
      }
      if (parts.length) texts.push(parts.join(''));
    }

    if (texts.length) lines.push(texts.join(' ').trim());
  }
  return lines;
}

/**
 * 解析商品行数据
 */
function parseInvoiceLines(lines) {
  const results = [];
  let i = 0;

  // 合并所有行为一个大文本，方便后续处理
  const fullText = lines.join('\n');

  while (i < lines.length) {
    const line = lines[i];

    // 匹配商品行：含有 字母+数字 形式的货号前缀 和 4位后缀
    const articleMatch = line.match(/\b([A-Z]{1,4}\d{4,6})\s+(\d{4})\b/);
    if (articleMatch) {
      const prefix = articleMatch[1];
      const suffix = articleMatch[2];
      const articleCode = buildArticleCode(prefix, suffix);

      // 提取描述（去掉货号和价格部分）
      const description = line
        .replace(articleMatch[0], '')
        .replace(/€?\s*[\d.,]+\s*$/, '')
        .trim();

      // 提取单价
      const priceMatch = line.match(/[\d]{1,4}[.,]\d{2}(?:\s*€)?$/);
      const price = priceMatch
        ? parseItalianNumber(priceMatch[0].replace('€', '').trim())
        : 0;

      // 在后续几行中查找 TGL 和 QTA 行
      let tglLine = '';
      let qtaLine = '';
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        if (/TGL|tgl/i.test(lines[j]) && !tglLine) tglLine = lines[j];
        if (/QTA|qta/i.test(lines[j]) && !qtaLine) qtaLine = lines[j];
        if (tglLine && qtaLine) break;
      }

      const sizes = parseSizeQtyLine(tglLine, 'TGL');
      const qtys = parseSizeQtyLine(qtaLine, 'QTA');

      if (sizes.length > 0 && qtys.length > 0) {
        const len = Math.min(sizes.length, qtys.length);
        for (let k = 0; k < len; k++) {
          if (parseFloat(qtys[k]) > 0) {
            results.push({
              articleCode,
              description: description || prefix,
              size: sizes[k],
              qty: qtys[k],
              price: price.toFixed(2),
            });
          }
        }
        i += 3;
        continue;
      }
    }
    i++;
  }

  return results;
}

/**
 * 解析 TGL/QTA 行，提取数值列表
 */
function parseSizeQtyLine(line, type) {
  if (!line) return [];
  const cleaned = line.replace(new RegExp(type, 'gi'), '').trim();
  return cleaned.match(/\d+(?:[.,]\d+)?/g) || [];
}

/**
 * 主入口：解析 PDF Invoice 文件
 */
export async function parsePdfInvoice(file) {
  let lines = [];

  try {
    // 方案1：使用 ArrayBuffer 解析
    const buffer = await readFileAsArrayBuffer(file);
    lines = extractTextFromPdfBytes(buffer);
  } catch (e) {
    console.warn('ArrayBuffer 解析失败，尝试文本方案：', e);
  }

  // 如果方案1没有有效内容，尝试文本读取
  if (!lines.some(l => /[A-Z]{1,4}\d{4,6}/.test(l))) {
    try {
      const text = await readFileAsText(file);
      lines = extractLinesFromText(text);
    } catch (e) {
      throw new Error('PDF 文件读取失败：' + e.message);
    }
  }

  if (lines.length === 0) {
    throw new Error('未能从 PDF 中提取到任何文本内容，请确认文件格式');
  }

  const data = parseInvoiceLines(lines);

  if (data.length === 0) {
    throw new Error('未能识别到商品数据，请确认文件为 CRISPI SPORT Invoice 格式');
  }

  return data;
}
