
import React from 'react';
import { DocumentChunk } from '../types';

interface DocumentPreviewProps {
  chunks: DocumentChunk[];
  mode: 'original' | 'translated';
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ chunks, mode }) => {
  const renderContent = () => {
    const renderedElements: React.ReactNode[] = [];
    let currentTableCells: DocumentChunk[] = [];

    const flushTable = () => {
      if (currentTableCells.length > 0) {
        renderedElements.push(renderTable(currentTableCells));
        currentTableCells = [];
      }
    };

    chunks.forEach((chunk, index) => {
      if (chunk.type === 'table-cell') {
        currentTableCells.push(chunk);
      } else {
        flushTable();
        renderedElements.push(renderChunk(chunk, index));
      }
    });

    flushTable();
    return renderedElements;
  };

  const renderTable = (cells: DocumentChunk[]) => {
    const rows: Record<number, DocumentChunk[]> = {};
    cells.forEach(cell => {
      const rowIndex = cell.metadata?.row ?? 0;
      if (!rows[rowIndex]) rows[rowIndex] = [];
      rows[rowIndex].push(cell);
    });

    const sortedRowIndices = Object.keys(rows).map(Number).sort((a, b) => a - b);

    return (
      <div key={`table-${cells[0].id}`} className="mb-6 overflow-x-auto">
        <table className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-[11pt]">
          <tbody>
            {sortedRowIndices.map(rowIndex => (
              <tr key={`row-${rowIndex}`} className="border-b border-slate-200 dark:border-slate-800">
                {rows[rowIndex]
                  .sort((a, b) => (a.metadata?.col ?? 0) - (b.metadata?.col ?? 0))
                  .map(cell => {
                    const text = mode === 'original' ? cell.originalText : cell.translatedText;
                    const weightClass = cell.metadata?.isBold ? 'font-bold' : 'font-normal';
                    const italicClass = cell.metadata?.isItalic ? 'italic' : '';
                    const underlineClass = cell.metadata?.isUnderlined ? 'underline' : '';
                    
                    return (
                      <td
                        key={cell.id}
                        rowSpan={cell.metadata?.rowSpan}
                        colSpan={cell.metadata?.colSpan}
                        className={`border border-slate-300 dark:border-slate-700 p-3 ${weightClass} ${italicClass} ${underlineClass} text-slate-700 dark:text-slate-300 bg-white/40 dark:bg-slate-800/20`}
                        style={{ textAlign: cell.metadata?.alignment || 'left' }}
                      >
                        {text || (mode === 'translated' && <div className="h-4 bg-blue-50/50 dark:bg-blue-900/10 rounded animate-pulse" />)}
                      </td>
                    );
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderChunk = (chunk: DocumentChunk, index: number) => {
    if (chunk.type === 'empty-line') {
      return <div key={`empty-${index}`} className="h-6 w-full" />;
    }

    const text = mode === 'original' ? chunk.originalText : chunk.translatedText;
    
    if (!text && mode === 'translated') {
       return (
         <div key={chunk.id} className="mb-4 space-y-2">
           <div className="h-4 w-full bg-blue-50 dark:bg-blue-900/10 rounded animate-pulse" />
         </div>
       );
    }

    const weightClass = chunk.metadata?.isBold || chunk.type === 'heading' ? 'font-bold' : 'font-normal';
    const italicClass = chunk.metadata?.isItalic ? 'italic' : '';
    const underlineClass = chunk.metadata?.isUnderlined ? 'underline underline-offset-4' : '';

    const customStyles: React.CSSProperties = {
      textAlign: (chunk.metadata?.alignment as any) || 'left',
    };

    if (chunk.type === 'checkbox') {
      return (
        <div key={chunk.id} className="flex items-start gap-3 mb-3">
          <div className={`w-5 h-5 rounded border border-slate-300 dark:border-slate-600 flex-shrink-0 flex items-center justify-center ${chunk.metadata?.isChecked ? 'bg-blue-600 border-blue-600' : 'bg-white'}`}>
            {chunk.metadata?.isChecked && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
          <span className={`${weightClass} ${italicClass} ${underlineClass} text-slate-700 dark:text-slate-300`}>{text}</span>
        </div>
      );
    }

    if (chunk.type === 'heading') {
      const level = chunk.metadata?.level || 1;
      const HeadingTag = `h${level}` as any;
      return (
        <HeadingTag 
          key={chunk.id} 
          className={`${weightClass} ${italicClass} ${underlineClass} mb-4 text-slate-900 dark:text-slate-100`}
          style={customStyles}
        >
          {text}
        </HeadingTag>
      );
    }

    return (
      <p 
        key={chunk.id} 
        className={`mb-4 leading-relaxed text-slate-700 dark:text-slate-300 ${weightClass} ${italicClass} ${underlineClass}`}
        style={customStyles}
      >
        {text}
      </p>
    );
  };

  return (
    <div className="document-paper min-h-full bg-white dark:bg-slate-900/30 p-8 md:p-14 shadow-sm rounded-xl border border-slate-100 dark:border-slate-800 transition-all duration-300">
      <div className="max-w-none">
        {renderContent()}
      </div>
      <style>{`
        .document-paper h1, .document-paper h2, .document-paper h3 {
          font-size: 14pt;
          font-weight: bold;
          margin-bottom: 12pt;
        }
        .document-paper p {
          font-size: 11pt;
          margin-bottom: 11pt;
        }
        .document-paper .underline {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default DocumentPreview;
