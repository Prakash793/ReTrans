
import { DocumentChunk } from "../types";

declare const mammoth: any;
declare const pdfjsLib: any;

export interface ProcessedFile {
  chunks: DocumentChunk[];
  fileData: string;
  mimeType: string;
}

export class FileService {
  async processFile(file: File): Promise<ProcessedFile> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const base64 = await this.toBase64(file);
    const mimeType = file.type || (extension === 'pdf' ? 'application/pdf' : 'text/plain');

    let chunks: DocumentChunk[] = [];
    
    if (extension === 'txt') {
      chunks = await this.processTxt(file);
    } else if (extension === 'docx') {
      if (typeof mammoth === 'undefined') {
        throw new Error("Word processing engine is still initializing. Please wait.");
      }
      chunks = await this.processDocx(file);
    } else if (extension === 'pdf') {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error("PDF processing engine is still initializing. Please wait.");
      }
      chunks = await this.processPdf(file);
    } else {
      throw new Error("Unsupported file format. Please use PDF, DOCX, or TXT.");
    }

    return {
      chunks,
      fileData: base64,
      mimeType
    };
  }

  private toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  }

  private async processTxt(file: File): Promise<DocumentChunk[]> {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    
    return lines.map((line, index) => {
      if (line.trim().length === 0) {
        return {
          id: `txt-empty-${index}`,
          type: 'empty-line',
          originalText: "",
        };
      }
      return {
        id: `chunk-${index}`,
        type: index === 0 ? 'heading' : 'paragraph',
        originalText: line,
        metadata: { alignment: 'left', isBold: index === 0, level: index === 0 ? 1 : undefined }
      };
    });
  }

  private async processDocx(file: File): Promise<DocumentChunk[]> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const chunks: DocumentChunk[] = [];
      
      const walk = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            chunks.push({
              id: `docx-h-${chunks.length}`,
              type: 'heading',
              originalText: el.innerText.trim(),
              metadata: { 
                level: parseInt(tagName.substring(1)), 
                isBold: true,
                isUnderlined: el.querySelector('u') !== null || el.style.textDecoration.includes('underline')
              }
            });
          } else if (tagName === 'p') {
            const text = el.innerText.trim();
            if (!text) {
              chunks.push({ id: `docx-e-${chunks.length}`, type: 'empty-line', originalText: "" });
              return;
            }

            const checkboxMatch = text.match(/^[\[(][xX\s][\])]|^[☐☑☒]/);
            
            chunks.push({
              id: `docx-p-${chunks.length}`,
              type: checkboxMatch ? 'checkbox' : 'paragraph',
              originalText: text,
              metadata: { 
                isBold: el.querySelector('strong, b') !== null,
                isItalic: el.querySelector('em, i') !== null,
                isUnderlined: el.querySelector('u') !== null || el.style.textDecoration.includes('underline') || !!el.closest('u'),
                isCheckbox: !!checkboxMatch,
                isChecked: text.includes('☑') || text.includes('☒') || /^[\[(][xX][\])]/.test(text)
              }
            });
          } else if (tagName === 'td' || tagName === 'th') {
            chunks.push({
              id: `docx-td-${chunks.length}`,
              type: 'table-cell',
              originalText: el.innerText.trim(),
              metadata: { 
                isBold: tagName === 'th' || el.querySelector('strong, b') !== null,
                isUnderlined: el.querySelector('u') !== null || el.style.textDecoration.includes('underline'),
                alignment: (el.style.textAlign as any) || 'left'
              }
            });
          } else if (tagName === 'br') {
            chunks.push({ id: `docx-br-${chunks.length}`, type: 'empty-line', originalText: "" });
          } else {
            for (let i = 0; i < el.childNodes.length; i++) {
              walk(el.childNodes[i]);
            }
          }
        }
      };

      walk(doc.body);
      return chunks;
    } catch (err) {
      console.error("DOCX extraction error:", err);
      throw new Error("Word document extraction failed. The file might be corrupted or protected.");
    }
  }

  private async processPdf(file: File): Promise<DocumentChunk[]> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const chunks: DocumentChunk[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        let currentLine = "";
        let lastY = -1;
        
        for (const item of (textContent.items as any[])) {
          const y = item.transform[5];
          if (lastY !== -1 && Math.abs(y - lastY) > 10) {
            if (currentLine.trim()) {
              chunks.push({
                id: `pdf-p-${chunks.length}`,
                type: 'paragraph',
                originalText: currentLine.trim(),
                metadata: { alignment: 'left' }
              });
            } else {
               chunks.push({ id: `pdf-e-${chunks.length}`, type: 'empty-line', originalText: "" });
            }
            currentLine = "";
          }
          currentLine += " " + item.str;
          lastY = y;
        }
        
        if (currentLine.trim()) {
          chunks.push({
            id: `pdf-p-${chunks.length}`,
            type: 'paragraph',
            originalText: currentLine.trim(),
            metadata: { alignment: 'left' }
          });
        }
      }
      return chunks;
    } catch (err) {
      console.error("PDF parsing error:", err);
      throw new Error("PDF mapping failed. This file might be an image-only scan; please try the Neural Vision mode.");
    }
  }
}

export const fileService = new FileService();
