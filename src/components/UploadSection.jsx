import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Upload, AlertCircle, FileText } from 'lucide-react';
import { parsePdfInvoice } from '@/lib/pdfParser';
import GiftBoxAnimation from './GiftBoxAnimation';

const DropZone = ({ dragging, onDragOver, onDragLeave, onDrop, onClick }) => (
  <div
    className={`relative rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 border-2 border-dashed
      ${dragging
        ? 'border-[#FF9F0A] bg-amber-50/60 scale-[1.01] drop-pulse'
        : 'border-gray-200 bg-white/60 hover:border-[#FFD60A] hover:bg-amber-50/30'
      }`}
    onClick={onClick}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
  >
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFD60A] to-[#FF9F0A] flex items-center justify-center mb-5 shadow-lg shadow-amber-200/60">
      <FileText size={28} className="text-white" strokeWidth={1.5} />
    </div>
    <p className="text-[16px] font-semibold text-gray-800 tracking-tight">
      拖拽 PDF 文件到此处
    </p>
    <p className="text-[13px] text-gray-400 mt-1.5 mb-5">
      支持 CRISPI SPORT Invoice 格式（含 OCR 识别）
    </p>
    <button className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-b from-[#FFD60A] to-[#FF9F0A] text-white text-[13px] font-medium shadow-md shadow-amber-200/60 hover:shadow-lg hover:shadow-amber-200/80 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200">
      <Upload size={13} strokeWidth={2.5} />
      选择文件
    </button>
  </div>
);

const UploadSection = forwardRef(({ onParsed, setParsing, parsing, setFileName, disableAnimation = false }, ref) => {
  const inputRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  // animPhase: 'idle' | 'throw' | 'done'
  const [animPhase, setAnimPhase] = useState('idle');
  // showAnim: 控制 GiftBoxAnimation 是否挂载（独立于 animPhase）
  const [showAnim, setShowAnim] = useState(false);
  const [currentFileName, setCurrentFileName] = useState('');

  const parsedResultRef = useRef(null);

  // 动画内部完成数据回调（降落伞阶段结束时触发）
  const handleReadyForResult = useCallback(() => {
    const result = parsedResultRef.current;
    if (result?.data?.length > 0) {
      onParsed(result.data);
      setStatus('success');
    } else {
      onParsed([]);
      setStatus('error');
      setErrorMsg('未能识别到商品数据，请查看原始文本确认内容是否正确提取');
      if (result?.rawText) setShowRaw(true);
    }
    setParsing(false);
    setProgressMsg('');
    parsedResultRef.current = null;
    setAnimPhase('done');
  }, [onParsed, setParsing]);

  // 动画完全淡出后的回调（canvas 自己淡出完毕 → 卸载组件）
  const handleAnimationDone = useCallback(() => {
    setShowAnim(false);
    setAnimPhase('idle');
  }, []);

  // 同步给 GiftBoxAnimation 的 onAnimationDone 就是 handleAnimationDone

  // 暴露 demo 动画触发
  useImperativeHandle(ref, () => ({
    triggerDemoAnimation: () => {
      // 重置
      setShowAnim(false);
      setAnimPhase('idle');

      setTimeout(() => {
        parsedResultRef.current = {
          data: [
            { articleCode: '49803500', description: 'MONACO LEEDS GTX BEIGE', size: '42', qty: '3', price: '103.50' },
            { articleCode: '56603200', description: 'MONACO LOW GTX BEIGE', size: '41', qty: '1', price: '103.50' },
            { articleCode: '56606900', description: 'MONACO LOW GTX GRAFITE', size: '38', qty: '6', price: '103.50' },
          ],
          rawText: '',
        };
        setCurrentFileName('demo_invoice.pdf');
        setFileName('demo_invoice.pdf');
        setStatus('idle');
        setErrorMsg('');
        setParsing(true);
        setShowAnim(true);
        setAnimPhase('throw');
      }, 50);
    }
  }));

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.pdf')) {
      setStatus('error');
      setErrorMsg('请上传 PDF 格式文件');
      return;
    }
    parsedResultRef.current = null;
    setCurrentFileName(file.name);
    setFileName(file.name);
    setStatus('idle');
    setErrorMsg('');
    setRawText('');
    setShowRaw(false);
    setProgressMsg('');
    setParsing(true);
    // no=1 时跳过动画，直接解析
    if (!disableAnimation) {
      setShowAnim(true);
      setAnimPhase('throw');
    }

    try {
      const result = await parsePdfInvoice(file, (msg) => setProgressMsg(msg));
      setRawText(result.rawText || '');
      if (disableAnimation) {
        // 无动画模式：直接展示结果
        if (result?.data?.length > 0) {
          onParsed(result.data);
          setStatus('success');
        } else {
          onParsed([]);
          setStatus('error');
          setErrorMsg('未能识别到商品数据，请查看原始文本确认内容是否正确提取');
          if (result?.rawText) setShowRaw(true);
        }
        setParsing(false);
        setProgressMsg('');
      } else {
        parsedResultRef.current = result;
      }
    } catch (e) {
      if (disableAnimation) {
        setStatus('error');
        setErrorMsg(e.message || '解析失败，请检查文件格式');
        setParsing(false);
        setProgressMsg('');
      } else {
        parsedResultRef.current = { data: [], rawText: '' };
        setErrorMsg(e.message || '解析失败，请检查文件格式');
      }
    }
  };

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl shadow-gray-200/60 p-6">
      {/* 动画层：独立挂载，不受 animPhase 影响，只受 showAnim 控制 */}
      {showAnim && (
        <GiftBoxAnimation
          progressMsg={progressMsg}
          fileName={currentFileName}
          onReadyForResult={handleReadyForResult}
          onAnimationDone={handleAnimationDone}
        />
      )}

      {/* 上传区：始终渲染，动画时被遮罩覆盖 */}
      <DropZone
        dragging={dragging}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !showAnim && inputRef.current?.click()}
      />

      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={onInputChange} />

      {status === 'error' && !showAnim && (
        <div className="mt-4 flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100 px-4 py-2.5 rounded-2xl">
          <AlertCircle size={15} strokeWidth={2} /> {errorMsg}
        </div>
      )}

      {rawText && !showAnim && (
        <div className="mt-4">
          <button className="text-[12px] text-[#FF9F0A] font-medium" onClick={() => setShowRaw(v => !v)}>
            {showRaw ? '隐藏' : '查看'}原始提取文本
          </button>
          {showRaw && (
            <pre className="mt-2 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] text-gray-500 max-h-60 overflow-auto whitespace-pre-wrap break-all leading-relaxed">
              {rawText || '（无内容）'}
            </pre>
          )}
        </div>
      )}
    </div>
  );
});

export default UploadSection;
