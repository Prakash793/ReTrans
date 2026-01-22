
import React, { useRef, useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, Plus, Building2, FileSignature, Receipt } from 'lucide-react';

interface FileUploaderProps {
  onUpload: (file: File) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      onUpload(files[0]);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      onUpload(files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        relative max-w-4xl mx-auto p-20 rounded-[3rem] border-[3px] border-dashed transition-all cursor-pointer overflow-hidden
        flex flex-col items-center gap-8 group
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 scale-[1.01] shadow-2xl' 
          : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-900 shadow-xl hover:shadow-2xl'}
      `}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileSelect}
        accept=".txt,.docx,.pdf"
      />
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-indigo-500/10 transition-colors"></div>

      <div className="flex gap-4 mb-2">
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
          <Building2 className="w-8 h-8 text-indigo-600" />
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors translate-y-2">
          <FileSignature className="w-8 h-8 text-indigo-600" />
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
          <Receipt className="w-8 h-8 text-indigo-600" />
        </div>
      </div>

      <div className="space-y-4 text-center max-w-sm relative z-10">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Upload Portfolio Data</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          Optimized for <span className="text-indigo-600 dark:text-indigo-400 font-bold">Leases, Amendments, and Real Estate Invoices</span>.
        </p>
        
        <div className="flex items-center justify-center gap-4 mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 w-full">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
             Contract (DOCX)
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
             Invoice (PDF)
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-6 text-[9px] font-black uppercase tracking-[0.4em] text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-500">
         Select Real Estate Document
      </div>
    </div>
  );
};

export default FileUploader;
