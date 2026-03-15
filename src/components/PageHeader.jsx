import { FileSpreadsheet } from 'lucide-react';

const PageHeader = () => (
  <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-sm">
    <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFD60A] to-[#FF9F0A] flex items-center justify-center shadow-md shadow-yellow-200">
          <FileSpreadsheet size={18} className="text-white" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 tracking-tight leading-none">
            CRISPI SPORT
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5 tracking-wide">采购单解析工具</p>
        </div>
      </div>
      <div className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
        Invoice PDF → Excel
      </div>
    </div>
  </header>
);

export default PageHeader;
