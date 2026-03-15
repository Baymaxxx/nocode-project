import UploadSection from '@/components/UploadSection';
import ResultTable from '@/components/ResultTable';
import PageHeader from '@/components/PageHeader';
import { useState, useRef } from 'react';

const Index = () => {
  const [parsedData, setParsedData] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  const uploadRef = useRef(null);

  // URL 参数 no=1 时禁用动画
  const disableAnimation = new URLSearchParams(window.location.search).get('no') === '1';

  // 预览动画：先清空旧数据，再注入假结果触发完整动画序列
  const previewAnimation = () => {
    setParsedData([]);
    setFileName('');
    if (uploadRef.current) {
      uploadRef.current.triggerDemoAnimation();
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* 苹果风格背景光晕 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-yellow-100/60 to-orange-100/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-amber-100/50 to-yellow-50/30 blur-3xl" />
      </div>

      <PageHeader />

      <main className="relative max-w-3xl mx-auto px-6 py-12 space-y-5">
        <div className="text-center mb-10">
          <h2 className="text-[28px] font-bold text-gray-900 tracking-tight leading-tight">
            Invoice 解析
          </h2>
          <p className="text-[15px] text-gray-400 mt-2">
            上传采购单 PDF，自动提取商品数据并导出 Excel
          </p>
          {/* 预览按钮：no=1 时隐藏 */}
          {!disableAnimation && (
            <button
              onClick={previewAnimation}
              className="mt-4 px-4 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-[12px] font-medium transition-all"
            >
              🎬 预览动画效果
            </button>
          )}
        </div>

        <UploadSection
          ref={uploadRef}
          onParsed={setParsedData}
          setParsing={setParsing}
          parsing={parsing}
          setFileName={setFileName}
          disableAnimation={disableAnimation}
        />

        {parsedData.length > 0 && (
          <ResultTable data={parsedData} fileName={fileName} />
        )}
      </main>
    </div>
  );
};

export default Index;
