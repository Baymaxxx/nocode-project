import { buildArticleCode, parseItalianNumber } from './invoiceUtils';
import * as pdfjsLib from 'pdfjs-dist';

// 使用本地 worker 文件
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// PDF解析API地址：优先使用环境变量配置的远程地址，否则回退到本地开发地址
const API_URL = import.meta.env.VITE_PDF_API_URL
  ? `${import.meta.env.VITE_PDF_API_URL}/api/parse-pdf`
  : 'http://localhost:3001/api/parse-pdf';

// 方案1: 调用本地Python API（推荐，OCR质量更好）
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

// 方案2: 浏览器端OCR（fallback）
async function parseInBrowser(file) {
  // 先尝试文本提取
  const lines = await extractTextLines(file);
  const hasContent = lines.some(l => /[A-Za-z]{1,4}\d{4,6}/.test(l));

  let parseLines = lines;

  if (!hasContent) {
    // 文本提取失败，尝试OCR
    parseLines = await extractTextByOCR(file);
  }

  const data = parseInvoiceLines(parseLines);
  if (data.length === 0) {
    throw new Error('浏览器端OCR未能识别到商品数据');
  }
  return data;
}

// 提取PDF文本行
async function extractTextLines(file) {
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

// 浏览器端OCR
async function extractTextByOCR(file) {
  const Tesseract = await import('tesseract.js');
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const allLines = [];
  const worker = await Tesseract.createWorker('ita+eng');

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 3.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const imageData = canvas.toDataURL('image/png');
      const { data: { text } } = await worker.recognize(imageData);
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      allLines.push(...lines);
    }
  } finally {
    await worker.terminate();
  }
  return token;
}

// 解析行数据
function parseInvoiceLines(lines) {
  const results = [];

  console.log('=== 开始解析，共', lines.length, '行 ===');
  lines.forEach((l, i) => console.log(`[${i}] ${l}`));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const articleMatch = line.match(/\b([A-Za-z]{1,4}\d{4,6})\s+(\d{4})\b/);
    if (articleMatch) {
      const prefix = articleMatch[1].toUpperCase();
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

function parseSizeQtyLine(line, type) {
  if (!line) return [];
  const cleaned = line.replace(new RegExp(type, 'gi'), '').trim();
  return cleaned.match(/\d+(?:[.,]\d+)?/g) || [];
}

// 主入口：优先调用本地API，失败则fallback到浏览器端
export async function parsePdfInvoice(file) {
  // 先尝试本地Python API
  try {
    console.log('尝试调用本地OCR API...');
    const data = await parseViaApi(file);
    console.log('API解析成功，共', data.length, '条记录');
    return data;
  } catch (apiError) {
    console.warn('本地API不可用，切换到浏览器端解析:', apiError.message);
  }

  // Fallback: 浏览器端解析
  try {
    console.log('使用浏览器端解析...');
    const data = await parseInBrowser(file);
    console.log('浏览器端解析成功，共', data.length, '条记录');
    return data;
  } catch (browserError) {
    console.error('浏览器端解析也失败:', browserError.message);
    throw new Error(
      '解析失败。请确保本地OCR服务已启动（python3 server.py），或确认文件为CRISPI Invoice格式。'
    );
  }
}
