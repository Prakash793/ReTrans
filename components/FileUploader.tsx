
import React, { useRef, useState } from 'react';
import { Upload, FileText, FileCheck } from 'lucide-react';

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      onUpload(files[0]);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`
        max-w-2xl mx-auto p-12 rounded-3xl border-2 border-dashed transition-all cursor-pointer
        flex flex-col items-center gap-6 group
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 scale-[1.02]' 
          : 'border-slate-300 dark:border-slate-800 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-900/40'}
      `}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileSelect}
        accept=".txt,.docx,.pdf"
      />
      
      <div className="relative">
        <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-xl shadow-indigo-500/30 group-hover:-translate-y-1 transition-transform">
          <Upload className="w-10 h-10" />
        </div>
        <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1 rounded-lg border-4 border-white dark:border-slate-950">
          <FileCheck className="w-4 h-4" />
        </div>
      </div>

      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">Upload your document</h2>
        <p className="text-slate-500 dark:text-slate-400">
          Drag & drop your files here, or <span className="text-indigo-600 font-semibold underline">browse</span>
        </p>
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 w-full">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <FileText className="w-3.5 h-3.5" /> PDF
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <FileText className="w-3.5 h-3.5" /> DOCX
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <FileText className="w-3.5 h-3.5" /> TXT
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
