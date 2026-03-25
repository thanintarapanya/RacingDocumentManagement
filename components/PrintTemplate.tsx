import React from 'react';
import { PORTRAIT_BG } from '@/lib/base64-bg';

interface PrintTemplateProps {
  data: any;
}

const PrintTemplate: React.FC<PrintTemplateProps> = ({ data }) => {
  return (
    <div 
      className="relative w-[210mm] h-[297mm] mx-auto bg-white overflow-hidden"
      style={{
        width: '210mm',
        height: '297mm',
      }}
    >
      {/* Background Image */}
      <img 
        src={PORTRAIT_BG} 
        alt="PDF Background" 
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
      />

      {/* Content Overlay */}
      <div className="relative z-10 w-full h-full p-12">
        {/* Header Section */}
        <div className="mt-32 mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Competitor Request Form</h1>
          <p className="text-lg text-gray-600 mt-2">ID: {data?.id || 'New'}</p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-6 mt-8 bg-white/90 p-6 rounded-lg border border-gray-200">
          <div>
            <p className="text-sm text-gray-500 font-semibold">Racer Name</p>
            <p className="text-lg text-gray-900">{data?.driverName || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-semibold">Car Number</p>
            <p className="text-lg text-gray-900">{data?.carNumber || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-semibold">Series</p>
            <p className="text-lg text-gray-900">{data?.series || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-semibold">Team Manager</p>
            <p className="text-lg text-gray-900">{data?.nameRequestPermission || '-'}</p>
          </div>
        </div>

        {/* Request Details */}
        <div className="mt-8 bg-white/90 p-6 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500 font-semibold mb-2">Request Details</p>
          <p className="text-gray-900 whitespace-pre-wrap">{data?.requestInfo || '-'}</p>
        </div>
      </div>
    </div>
  );
};

export default PrintTemplate;
