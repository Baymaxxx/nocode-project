import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Package } from 'lucide-react';
import { exportToExcel } from '@/lib/excelExporter';

const ResultTable = ({ data, fileName }) => {
  const handleExport = () => exportToExcel(data, fileName);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={18} className="text-[#1677ff]" />
          <CardTitle className="text-base font-semibold text-gray-800">
            解析结果 <span className="text-[#1677ff]">({data.length} 条)</span>
          </CardTitle>
        </div>
        <Button
          onClick={handleExport}
          className="bg-[#1677ff] hover:bg-[#0958d9] gap-2"
          size="sm"
        >
          <Download size={14} /> 导出 Excel
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#e6f0ff] text-[#1677ff]">
                {['序号', '货号', '品名', '尺码', '数量', '单价(€)'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                >
                  <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2 font-mono font-semibold text-gray-800">{row.articleCode}</td>
                  <td className="px-4 py-2 text-gray-600 max-w-[200px] truncate">{row.description}</td>
                  <td className="px-4 py-2 text-gray-700">{row.size}</td>
                  <td className="px-4 py-2 text-gray-700">{row.qty}</td>
                  <td className="px-4 py-2 text-gray-700">{row.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultTable;
