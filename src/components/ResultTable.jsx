import { Download, Package } from 'lucide-react';
import { exportToExcel } from '@/lib/excelExporter';

const ResultTable = ({ data, fileName }) => {
  const handleExport = () => exportToExcel(data, fileName);

  return (
    <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl shadow-gray-200/60 overflow-hidden">
      {/* 头部 */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100/80">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FFD60A] to-[#FF9F0A] flex items-center justify-center shadow-sm shadow-amber-200/60">
            <Package size={14} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <span className="text-[14px] font-semibold text-gray-800 tracking-tight">解析结果</span>
            <span className="ml-2 text-[12px] text-gray-400 font-normal">{data.length} 条记录</span>
          </div>
        </div>

        {/* 导出按钮 */}
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-b from-[#FFD60A] to-[#FF9F0A] text-white text-[12px] font-medium shadow-md shadow-amber-200/60 hover:shadow-lg hover:scale-[1.03] active:scale-[0.97] transition-all duration-200"
        >
          <Download size={12} strokeWidth={2.5} />
          导出 Excel
        </button>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-gray-50/80">
              {['#', '货号', '品名', '尺码', '数量', '单价 (€)'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-amber-50/40 transition-colors duration-150 group"
              >
                <td className="px-5 py-3 text-[12px] text-gray-300 font-mono">{String(i + 1).padStart(2, '0')}</td>
                <td className="px-5 py-3 font-mono font-semibold text-gray-800 tracking-wide">{row.articleCode}</td>
                <td className="px-5 py-3 text-gray-500 max-w-[220px] truncate">{row.description}</td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[11px] font-medium">
                    {row.size}
                  </span>
                </td>
                <td className="px-5 py-3 font-semibold text-gray-800">{row.qty}</td>
                <td className="px-5 py-3 font-mono text-gray-700">
                  <span className="text-[#FF9F0A] font-semibold">€</span> {row.price}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 底部统计 */}
      <div className="px-6 py-3 border-t border-gray-100/80 bg-gray-50/40 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">共 {data.length} 条商品记录</span>
        <span className="text-[11px] text-gray-400">
          总数量：<span className="font-semibold text-gray-600">{data.reduce((s, r) => s + (Number(r.qty) || 0), 0)}</span>
        </span>
      </div>
    </div>
  );
};

export default ResultTable;
