import { buildArticleCode, parseItalianNumber } from './invoiceUtils';

// 使用正确的 pdfjs-dist 导入路径
let pdfjsLib = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  try {
    const pdfjs = await import('pdfjs-dist');
    // 使用固定版本号，避免版本不匹配问题
    // 使用本地 worker，避免 CDN 网络问题
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    pdfjsLib = pdfjs;
    return pdfjsLib;
  } catch (e) {
    console.error('PDF.js 加载失败:', e);
    throw new Error('PDF解析库加载失败，请刷新页面重试');
  }
}

// PDF解析API地址：优先使用环境变量配置的远程地址，否则回退到本地开发地址
const API_URL = import.meta.env.VITE_PDF_API_URL
  ? `${import.meta.env.VITE_PDF_API_URL}/api/parse-pdf`
  : 'http://localhost:3001/api/parse-pdf';

// 方案1: 调用远程Python API（推荐，OCR质量更好）
async function parseViaApi(file) {
  const formData = new FormData();
  formData.append('file', file);

  const resp = await fetch(API_URL, {
    method: 'POST',
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: '服务器错误' }));
    throw new Error(err.error || '解析失败');
  }

  const result = await resp.json();
  if (!result.success || !result.data?.length) {
    throw new Error('未能识别到商品数据');
  }

  return result.data;
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

    const yMap = new Map();
    for (const item of textContent.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!yMap.has(y)) yMap.set(y, []);
      yMap.get(y).push({ x: item.transform[4], text: item.str });
    }

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

    const articleMatch = line.match(/\b([A-Z]{1,4}\d{4,6})\s+(\d{4})\b/);
    if (articleMatch) {
      const prefix = articleMatch[1];
      const suffix = articleMatch[2];
      const articleCode = buildArticleCode(prefix, suffix);
      const description = line.replace(articleMatch[0], '').replace(/€?\s*[\d.,]+\s*$/, '').trim();

      const priceMatch = line.match(/[\d]{1,4}[.,]\d{2}(?:\s*€)?$/);
      const price = priceMatch ? parseItalianNumber(priceMatch[0].replace('€', '').trim()) : 0;

      let tglLine = '', qtaLine = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (/TGL|tgl/i.test(lines[j])) { tglLine = lines[j]; }
        if (/QTA|qta/i.test(lines[j])) { qtaLine = lines[j]; }
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

// 解析TGL/QTA行,提取数值列表
function parseSizeQtyLine(line, type) {
  if (!line) return [];
  const cleaned = line.replace(new RegExp(type, 'gi'), '').trim();
  const tokens = cleaned.match(/\d+(?:[.,]\d+)?/g) || [];
  return tokens;
}

// 方案2: 浏览器端解析（fallback）
async function parseInBrowser(file) {
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
    throw new Error('未能识别到商品数据,请确认文件为CRISPI Invoice格式');
  }
  return data;
}

// 主入口：优先调用远程API，失败则fallback到浏览器端
export async function parsePdfInvoice(file, onProgress) {
  // 先尝试远程Python API
  try {
    if (onProgress) onProgress('正在调用远程OCR服务...');
    console.log('尝试调用远程OCR API...');
    const data = await parseViaApi(file);
    console.log('API解析成功，共', data.length, '条记录');
    return { data, rawText: JSON.stringify(data, null, 2) };
  } catch (apiError) {
    console.warn('远程API不可用，切换到浏览器端解析:', apiError.message);
  }

  // Fallback: 浏览器端解析
  try {
    if (onProgress) onProgress('远程服务不可用，使用浏览器端解析...');
    console.log('使用浏览器端解析...');
    const data = await parseInBrowser(file);
    console.log('浏览器端解析成功，共', data.length, '条记录');
    return { data, rawText: JSON.stringify(data, null, 2) };
  } catch (browserError) {
    console.error('浏览器端解析也失败:', browserError.message);
    throw new Error(
      '解析失败。请确保OCR服务可用，或确认文件为CRISPI Invoice格式。'
    );
  }
}
