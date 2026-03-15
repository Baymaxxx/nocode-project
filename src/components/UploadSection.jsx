import { useRef, useState } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { parsePdfInvoice } from '@/lib/pdfParser';

const StatusMessage = ({ status, errorMsg }) => {
  if (status === 'success') {
    return (
      <div className="mt-3 flex items-center gap-2 text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">
        <CheckCircle2 size={16} /> 解析成功！
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="mt-3 flex items-center gap-2 text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">
        <AlertCircle size={16} /> {errorMsg}
      </div>
    );
  }
  return null;
};

const LoadingAnimation = ({ progressMsg }) => (
  <div className="relative flex flex-col items-center">
    {/* 简约圆形加载器 */}
    <div className="relative w-24 h-24 mb-8">
      {/* 外圈 - 静态背景 */}
      <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>

      {/* 旋转圈 */}
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin"></div>

      {/* 中心图标 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <FileText className="w-10 h-10 text-blue-600 animate-pulse" />
      </div>
    </div>

    {/* 简约文字 */}
    <div className="text-center">
      <p className="text-lg font-medium text-gray-800 mb-2">
        正在解析 PDF
      </p>

      {/* 进度消息 */}
      {progressMsg && (
        <p className="text-sm text-gray-500 animate-fade-in">
          {progressMsg}
        </p>
      )}
    </div>

    {/* 简约进度条 */}
    <div className="mt-6 w-64">
      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full w-full bg-blue-600 animate-progress-slide origin-left"></div>
      </div>
    </div>
  </div>
);

const DropZone = ({ parsing, progressMsg, dragging, onDragOver, onDragLeave, onDrop, onClick }) => (
  <div
    className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300
      ${dragging ? 'border-[#1677ff] bg-blue-50 scale-105' : 'border-gray-200 bg-gray-50 hover:border-[#1677ff] hover:bg-blue-50'}
      ${parsing ? 'cursor-not-allowed' : ''}`}
    onClick={onClick}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
  >
    {parsing ? (
      <LoadingAnimation progressMsg={progressMsg} />
    ) : (
      <>
        <div className="bg-blue-50 rounded-full p-4 mb-3 transition-transform hover:scale-110">
          <FileText size={36} className="text-[#1677ff]" />
        </div>
        <p className="text-gray-700 font-medium">点击或拖拽 PDF 文件到此处</p>
        <p className="text-gray-400 text-sm mt-1">支持 CRISPI SPORT Invoice 格式（含OCR识别）</p>
        <Button className="mt-4 bg-[#1677ff] hover:bg-[#0958d9] transition-all hover:scale-105" size="sm">
          <Upload size={14} className="mr-1" /> 选择文件
        </Button>
      </>
    )}
  </div>
);

const UploadSection = ({ onParsed, setParsing, parsing, setFileName }) => {
  const inputRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.pdf')) {
      setStatus('error');
      setErrorMsg('请上传 PDF 格式文件');
      return;
    }
    setFileName(file.name);
    setStatus('idle');
    setErrorMsg('');
    setRawText('');
    setShowRaw(false);
    setProgressMsg('');
    setParsing(true);

    try {
      const result = await parsePdfInvoice(file, (msg) => setProgressMsg(msg));
      setRawText(result.rawText || '');
      if (result.data && result.data.length > 0) {
        onParsed(result.data);
        setStatus('success');
      } else {
        onParsed([]);
        setStatus('error');
        setErrorMsg('未能识别到商品数据，请查看原始文本确认内容是否正确提取');
        setShowRaw(true);
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.message || '解析失败，请检查文件格式');
      onParsed([]);
    } finally {
      setParsing(false);
      setProgressMsg('');
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
    <Card className="border-0 shadow-sm">
      <CardContent className="p-6">
        <DropZone
          parsing={parsing}
          progressMsg={progressMsg}
          dragging={dragging}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !parsing && inputRef.current?.click()}
        />
        <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={onInputChange} />
        <StatusMessage status={status} errorMsg={errorMsg} />

        {rawText && (
          <div className="mt-3">
            <button
              className="text-xs text-[#1677ff] underline"
              onClick={() => setShowRaw(v => !v)}
            >
              {showRaw ? '隐藏' : '查看'}原始提取文本（用于调试）
            </button>
            {showRaw && (
              <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 max-h-60 overflow-auto whitespace-pre-wrap break-all">
                {rawText || '（无内容）'}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UploadSection;
