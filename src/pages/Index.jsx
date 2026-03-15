import UploadSection from '@/components/UploadSection';
import ResultTable from '@/components/ResultTable';
import PageHeader from '@/components/PageHeader';
import { useState } from 'react';

const Index = () => {
  const [parsedData, setParsedData] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState('');

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <PageHeader />
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <UploadSection
          onParsed={setParsedData}
          setParsing={setParsing}
          parsing={parsing}
          setFileName={setFileName}
        />
        {parsedData.length > 0 && (
          <ResultTable data={parsedData} fileName={fileName} />
        )}
      </main>
    </div>
  );
};

export default Index;
