
import React, { useRef, useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, Plus } from 'lucide-react';

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
    // Prevent event bubbling issues
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      onUpload(files[0]);
    }
    // Reset value to allow selecting the same file again if needed
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
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 scale-[1.01] shadow-2xl' 
          : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:bg-white dark:hover:bg-slate-900 shadow-xl hover:shadow-2xl'}
      `}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileSelect}
        accept=".txt,.docx,.pdf"
      />
      
      {/* Decorative Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-colors"></div>

      <div className="relative">
        <div className="bg-blue-600 text-white p-6 rounded-3xl shadow-2xl shadow-blue-500/30 group-hover:-translate-y-2 transition-transform duration-500">
          <Upload className="w-12 h-12" />
        </div>
        <div className="absolute -bottom-3 -right-3 bg-white dark:bg-slate-950 p-2 rounded-xl border-4 border-slate-50 dark:border-slate-950 shadow-lg scale-110">
          <Plus className="w-5 h-5 text-blue-600" />
        </div>
      </div>

      <div className="space-y-4 text-center max-w-sm relative z-10">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Drop your document</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          Supports <span className="text-slate-900 dark:text-white font-bold">PDF, Word, or Text</span>. Maximum file size is 25MB for neural mapping.
        </p>
        
        <div className="flex items-center justify-center gap-6 mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 w-full">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
             PDF
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
             DOCX
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
             TXT
          </div>
        </div>
      </div>
      
      {/* Interaction Hint */}
      <div className="absolute bottom-6 text-[9px] font-black uppercase tracking-[0.4em] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-500">
         Click to browse filesystem
      </div>
    </div>
  );
};

export default FileUploader;
