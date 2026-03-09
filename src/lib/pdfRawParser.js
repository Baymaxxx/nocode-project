/**
 * PDF文本提取 + OCR双模式解析器
 * 1. 优先用pdfjs提取文本层
 * 2. 如果文本层缺少数字数据，则渲染页面为图片，用tesseract.js OCR识别
 */

let pdfjsLib = null;

async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('pdfjs-script');
    if (existing && window.pdfjsLib) {
      pdfjsLib = window.pdfjsLib;
      return resolve(pdfjsLib);
    }
    if (existing) {
      const check = setInterval(() => {
        if (window.pdfjsLib) { clearInterval(check); pdfjsLib = window.pdfjsLib; resolve(pdfjsLib); }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('pdfjs加载超时')); }, 20000);
      return;
    }
    const script = document.createElement('script');
    script.id = 'pdfjs-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        pdfjsLib = window.pdfjsLib;
        resolve(pdfjsLib);
      } else {
        reject(new Error('pdfjs加载后window.pdfjsLib不存在'));
      }
    };
    script.onerror = () => reject(new Error('pdfjs CDN加载失败'));
    document.head.appendChild(script);
  });
}

/** 从PDF页面提取文本行（按Y坐标分组） */
async function extractTextLinesFromPage(page) {
  const textContent = await page.getTextContent();
  const itemsByY = new Map();
  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    if (!itemsByY.has(y)) itemsByY.set(y, []);
    itemsByY.get(y).push({ x: item.transform[4], str: item.str });
  }
  const sortedYs = Array.from(itemsByY.keys()).sort((a, b) => b - a);
  return sortedYs.map(y => {
    const items = itemsByY.get(y).sort((a, b) => a.x - b.x);
    return items.map(i => i.str).join(' ').trim();
  }).filter(Boolean);
}

/**
 * 将PDF页面渲染为高对比度canvas，提升OCR准确率
 * scale 使用3.5以上以获得更高分辨率
 */
async function renderPageToCanvas(page, scale = 3.5) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  // 白色背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  // 图像后处理：提高对比度，使文字更清晰
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // 灰度化
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    // 增强对比度：阈值化（低于180的当作黑色，其余白色）
    const val = gray < 180 ? 0 : 255;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

/**
 * OCR后处理：修正数字/字母混淆
 * 主要问题：数字0被识别成O，数字1被识别成l/I
 */
function fixOcrText(text) {
  return text
    .split('\n')
    .map(line => fixOcrLine(line))
    .join('\n');
}

function fixOcrLine(line) {
  // 修正 TGL / QTA 行中的数字：这些行应该全是数字
  // 先识别 TGL 或 QTA 开头的行
  if (/^(TGL|QTA|TG[Li1|]|QT[Aa4])\s/i.test(line)) {
    // 替换这些行中常见的字母->数字混淆
    return line.replace(/\bTG[Li1|I]\b/i, 'TGL')
               .replace(/\bQT[Aa4@]\b/i, 'QTA')
               .replace(/(?<=\s)[Oo](?=\s|$)/g, '0')  // 独立的O -> 0
               .replace(/(?<=\s)[Il|](?=\s|$)/g, '1') // 独立的I/l -> 1
               .replace(/(?<=\d)[Oo](?=\d|\s|$)/g, '0')
               .replace(/(?<=\s)[Oo](?=\d)/g, '0');
  }

  // 货号行：如 TH5660 0115 — 其中连续数字中的O应为0
  // 对所有看起来是货号/数字序列的token做修正
  return line.replace(/\b([A-Z]{1,3})([0-9OoIl|]{3,})\s+([0-9OoIl|]{4})\b/g, (m, p1, p2, p3) => {
    const fixNum = s => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
    return p1 + fixNum(p2) + ' ' + fixNum(p3);
  });
}

/** 使用tesseract.js对canvas进行OCR */
async function ocrCanvas(canvas, onProgress) {
  const { createWorker } = await import('tesseract.js');

  // 使用英语（意大利语会干扰数字识别）
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });

  // PSM 4: 假设单列可变大小文本 —— 适合发票
  // OEM 1: 使用LSTM引擎（对打印体数字更准确）
  await worker.setParameters({
    tessedit_pageseg_mode: '4',
    // 不使用 whitelist，让LSTM自由识别，准确率更高
    preserve_interword_spaces: '1',
  });

  const { data: { text } } = await worker.recognize(canvas);
  await worker.terminate();

  console.log('OCR原始文本:\n', text);
  return fixOcrText(text);
}

/** 判断文本行是否包含有效的商品数字数据 */
function hasProductData(lines) {
  return lines.some(l => /\bTGL\b/i.test(l) || /\bQTA\b/i.test(l) || /\b[A-Z]{1,3}\d{4,}\s+\d{4}\b/.test(l));
}

/**
 * 主函数：从PDF ArrayBuffer提取文本
 * @param {ArrayBuffer} buffer
 * @param {Function} onProgress - 进度回调 (message, percent)
 * @returns {Promise<string[]>}
 */
export async function extractTextFromPdfBytes(buffer, onProgress) {
  const pdfjs = await loadPdfjs();
  onProgress?.('正在加载PDF...', 10);

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  let allLines = [];

  // 第一步：提取所有页面的文本层
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const lines = await extractTextLinesFromPage(page);
    allLines = allLines.concat(lines);
  }

  onProgress?.('检查文本内容...', 20);
  console.log('文本层提取结果:', allLines.length, '行');
  console.log('文本预览(前20行):', allLines.slice(0, 20));

  // 第二步：判断是否需要OCR
  if (hasProductData(allLines)) {
    console.log('文本层包含商品数据，无需OCR');
    onProgress?.('文本提取完成', 100);
    return allLines;
  }

  // 第三步：文本层不含商品数据，启用OCR
  console.log('文本层缺少商品数据，启动OCR识别...');
  onProgress?.('文本层无商品数据，启动OCR识别（预计1-2分钟）...', 25);

  const ocrLines = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const progressBase = 25 + Math.round((pageNum - 1) / pdf.numPages * 70);
    onProgress?.(`正在处理第${pageNum}/${pdf.numPages}页...`, progressBase);

    const page = await pdf.getPage(pageNum);
    const canvas = await renderPageToCanvas(page, 3.5);

    onProgress?.(`OCR识别第${pageNum}页中...`, progressBase + 5);
    const ocrText = await ocrCanvas(canvas, (pct) => {
      onProgress?.(`OCR第${pageNum}页: ${pct}%`, progressBase + Math.round(pct / 100 * (70 / pdf.numPages)));
    });

    const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
    ocrLines.push(...lines);
    console.log(`第${pageNum}页OCR完成，${lines.length}行:`);
    lines.forEach((l, i) => console.log(`  [${i}] ${l}`));
  }

  onProgress?.('OCR完成', 100);
  console.log('OCR总行数:', ocrLines.length);
  return ocrLines.length > 0 ? ocrLines : allLines;
}
