
import React from 'react';
import { DocumentChunk } from '../types';

interface DocumentPreviewProps {
  chunks: DocumentChunk[];
  mode: 'original' | 'translated';
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ chunks, mode }) => {
  // Group consecutive table cells into tables
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
        renderedElements.push(renderChunk(chunk));
      }
    });

    flushTable();
    return renderedElements;
  };

  const renderTable = (cells: DocumentChunk[]) => {
    // Determine rows
    const rows: Record<number, DocumentChunk[]> = {};
    cells.forEach(cell => {
      const rowIndex = cell.metadata?.row ?? 0;
      if (!rows[rowIndex]) rows[rowIndex] = [];
      rows[rowIndex].push(cell);
    });

    const sortedRowIndices = Object.keys(rows).map(Number).sort((a, b) => a - b);

    return (
      <div key={`table-${cells[0].id}`} className="mb-8 overflow-x-auto">
        <table className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-sm">
          <tbody>
            {sortedRowIndices.map(rowIndex => (
              <tr key={`row-${rowIndex}`} className="border-b border-slate-200 dark:border-slate-800">
                {rows[rowIndex]
                  .sort((a, b) => (a.metadata?.col ?? 0) - (b.metadata?.col ?? 0))
                  .map(cell => {
                    const text = mode === 'original' ? cell.originalText : cell.translatedText;
                    const weightClass = cell.metadata?.isBold ? 'font-bold' : 'font-normal';
                    const italicClass = cell.metadata?.isItalic ? 'italic' : '';
                    
                    return (
                      <td
                        key={cell.id}
                        rowSpan={cell.metadata?.rowSpan}
                        colSpan={cell.metadata?.colSpan}
                        className={`border border-slate-300 dark:border-slate-700 p-3 ${weightClass} ${italicClass} text-slate-700 dark:text-slate-300 bg-white/40 dark:bg-slate-800/20`}
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

  const renderChunk = (chunk: DocumentChunk) => {
    const text = mode === 'original' ? chunk.originalText : chunk.translatedText;
    
    if (!text && mode === 'translated') {
       return (
         <div key={chunk.id} className="mb-4 space-y-2">
           <div className="h-4 w-full bg-blue-50 dark:bg-blue-900/10 rounded animate-pulse" />
           <div className="h-4 w-5/6 bg-blue-50 dark:bg-blue-900/10 rounded animate-pulse opacity-60" />
         </div>
       );
    }

    const customStyles: React.CSSProperties = {
      fontSize: chunk.metadata?.fontSize,
      fontFamily: chunk.metadata?.fontFamily,
      textAlign: chunk.metadata?.alignment || 'left',
    };

    const weightClass = chunk.metadata?.isBold ? 'font-bold' : 'font-normal';
    const italicClass = chunk.metadata?.isItalic ? 'italic' : '';

    switch (chunk.type) {
      case 'heading':
        const level = chunk.metadata?.level || 1;
        const HeadingTag = `h${level}` as any;
        const headingSize = level === 1 ? 'text-3xl' : level === 2 ? 'text-2xl' : 'text-xl';
        return (
          <HeadingTag 
            key={chunk.id} 
            className={`${headingSize} ${weightClass} ${italicClass} mb-6 leading-tight font-lexend text-slate-900 dark:text-slate-100`}
            style={customStyles}
          >
            {text}
          </HeadingTag>
        );
      default:
        return (
          <p 
            key={chunk.id} 
            className={`mb-4 leading-relaxed text-slate-700 dark:text-slate-300 ${weightClass} ${italicClass} ${text === ' ' ? 'h-6' : ''}`}
            style={customStyles}
          >
            {text}
          </p>
        );
    }
  };

  return (
    <div className="document-paper min-h-full bg-white dark:bg-slate-900/50 p-8 md:p-12 shadow-inner rounded-xl border border-slate-100 dark:border-slate-800">
      <div className="max-w-none prose prose-slate dark:prose-invert">
        {renderContent()}
      </div>
      <style>{`
        .document-paper h1, .document-paper h2, .document-paper h3, .document-paper p {
          margin-top: 0 !important;
          color: inherit !important;
        }
        .document-paper table {
          border-collapse: collapse !important;
          margin-top: 1rem !important;
          margin-bottom: 1rem !important;
        }
      `}</style>
    </div>
  );
};

export default DocumentPreview;
