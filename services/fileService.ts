
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
        // Remove the data:mime/type;base64, prefix
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
      const result = await mammoth.extractRawText({ arrayBuffer });
      const lines = result.value.split(/\n\n/).filter((l: string) => l.trim().length > 0);
      
      return lines.map((line: string, index: number) => ({
        id: `docx-${index}`,
        type: index === 0 ? 'heading' : 'paragraph',
        originalText: line.trim(),
        metadata: { alignment: 'left', level: index === 0 ? 1 : undefined }
      }));
    } catch (err) {
      console.error("DOCX parsing error:", err);
      throw new Error("Failed to parse Word document structure.");
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
        
        for (const item of textContent.items) {
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
      
      // We don't return the "Empty" error chunk here anymore, 
      // the App will handle empty chunks by using Multimodal fallback.
      return chunks;
    } catch (err) {
      console.error("PDF parsing error:", err);
      // Even if parsing fails, we return empty chunks so fallback can take over
      return [];
    }
  }
}

export const fileService = new FileService();
