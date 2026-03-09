import { buildArticleCode, parseItalianNumber } from './invoiceUtils';

// 使用正确的 pdfjs-dist 导入路径
let pdfjsLib = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  // 修复导入路径，使用标准的 pdfjs-dist 包
  const pdfjs = await import('pdfjs-dist');
  // 使用 pdfjs-dist 提供的 worker
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  pdfjsLib = pdfjs;
  return pdfjsLib;
}

// 提取PDF所有页面的文本行
async function extractTextLines(file) {
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // 按Y坐标分组,合并同行文字
    const yMap = new Map();
    for (const item of textContent.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!yMap.has(y)) yMap.set(y, []);
      yMap.get(y).push({ x: item.transform[4], text: item.str });
    }

    // 按Y从大到小(页面从上到下),每行按X排序拼接
    const sortedYs = Array.from(yMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const line = yMap.get(y).sort((a, b) => a.x - b.x).map(i => i.text).join(' ');
      allLines.push(line.trim());
    }
  }
  return allLines;
}

// 尝试OCR识别(当文本提取不到有效内容时)
async function extractTextByOCR(file) {
  const Tesseract = await import('tesseract.js');
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const imageData = canvas.toDataURL('image/png');
    const { data: { text } } = await Tesseract.default.recognize(imageData, 'ita+eng');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    allLines.push(...lines);
  }
  return allLines;
}

// 解析行数据,提取商品信息
function parseInvoiceLines(lines) {
  const results = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 匹配商品描述行:含有类似TH5660 或字母+数字 形式的 Articolo 字段
    const articleMatch = line.match(/\b([A-Z]{1,4}\d{4,6})\s+(\d{4})\b/);
    if (articleMatch) {
      const prefix = articleMatch[1];
      const suffix = articleMatch[2];
      const articleCode = buildArticleCode(prefix, suffix);
      const description = line.replace(articleMatch[0], '').replace(/€?\s*[\d.,]+\s*$/, '').trim();

      // 提取单价(意大利格式)
      const priceMatch = line.match(/[\d]{1,4}[.,]\d{2}(?:\s*€)?$/);
      const price = priceMatch ? parseItalianNumber(priceMatch[0].replace('€', '').trim()) : 0;

      // 查找后续 TGL 行和 QTA 行
      let tglLine = '', qtaLine = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if(/TGL|tgl/i.test(lines[j])) { tglLine = lines[j]; }
        if (/QTA|qta/i.test(lines[j])) { qtaLine = lines[j]; }if (tglLine && qtaLine) break;
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

// 解析TGL/QTA 行,提取数值列表
function parseSizeQtyLine(line, type) {
  if (!line) return [];
  const cleaned = line.replace(new RegExp(type, 'gi'), '').trim();
  const tokens = cleaned.match(/\d+(?:[.,]\d+)?/g) || [];
  return tokens;
}

// 主入口
export async function parsePdfInvoice(file) {
  let lines = [];
  let parseError = null;

  try {
    lines = await extractTextLines(file);
  } catch (e) {
    parseError = e;
    console.warn('文本提取失败,尝试OCR:', e);
  }

  const hasContent = lines.some(l => /[A-Z]{1,4}\d{4,6}/.test(l));

  if (!hasContent || parseError) {
    try {
      lines = await extractTextByOCR(file);
    } catch (e) {
      throw new Error('PDF解析和OCR均失败,请确认文件格式是否正确');
    }
  }

  const data = parseInvoiceLines(lines);

  if (data.length === 0) {
    throw new Error('未能识别到商品数据,请确认文件为CRISPI Invoice 格式');
  }
  return data;
}
