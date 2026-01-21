
import { DocumentChunk } from "../types";

// Access global libraries from CDN
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
      chunks = await this.processDocx(file);
    } else if (extension === 'pdf') {
      chunks = await this.processPdf(file);
    } else {
      throw new Error("Unsupported file format.");
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
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    return lines.map((line, index) => ({
      id: `chunk-${index}`,
      type: index === 0 ? 'heading' : 'paragraph',
      originalText: line,
      metadata: { alignment: 'left', isBold: index === 0, level: index === 0 ? 1 : undefined }
    }));
  }

  private async processDocx(file: File): Promise<DocumentChunk[]> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Use convertToHtml to preserve structure (bold, tables, headings)
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
              metadata: { level: parseInt(tagName.substring(1)), isBold: true }
            });
          } else if (tagName === 'p') {
            const text = el.innerText.trim();
            if (text) {
              chunks.push({
                id: `docx-p-${chunks.length}`,
                type: 'paragraph',
                originalText: text,
                metadata: { 
                  isBold: el.querySelector('strong, b') !== null,
                  isItalic: el.querySelector('em, i') !== null
                }
              });
            }
          } else if (tagName === 'td' || tagName === 'th') {
            chunks.push({
              id: `docx-td-${chunks.length}`,
              type: 'table-cell',
              originalText: el.innerText.trim(),
              metadata: { 
                isBold: tagName === 'th' || el.querySelector('strong, b') !== null,
                alignment: (el.style.textAlign as any) || 'left'
              }
            });
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
      console.error("DOCX structure extraction error:", err);
      throw new Error("Failed to extract document structure.");
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
          if (lastY !== -1 && Math.abs(y - lastY) > 5) {
            if (currentLine.trim()) {
              chunks.push({
                id: `pdf-p-${chunks.length}`,
                type: 'paragraph',
                originalText: currentLine.trim(),
                metadata: { alignment: 'left' }
              });
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
      return [];
    }
  }
}

export const fileService = new FileService();
