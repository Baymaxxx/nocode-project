import { FileSpreadsheet } from 'lucide-react';

const PageHeader = () => (
  <header className="bg-[#1677ff] shadow-md">
    <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
      <div className="bg-white/20 rounded-lg p-2">
        <FileSpreadsheet size={24} className="text-white" />
      </div>
      <div>
        <h1 className="text-white text-xl font-bold leading-tight">
          CRISPI SPORT 采购单解析工具
        </h1>
        <p className="text-blue-100 text-sm">自动提取 Invoice PDF 中的商品数据并导出 Excel</p>
      </div>
    </div>
  </header>
);

export default PageHeader;
