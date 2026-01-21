
export interface Language {
  code: string;
  name: string;
  flag: string;
}

export type TranslationTone = 'professional' | 'legal' | 'technical' | 'creative' | 'medical';

export interface GlossaryItem {
  id: string;
  original: string;
  target: string;
}

export interface DocumentChunk {
  id: string;
  type: 'heading' | 'paragraph' | 'list-item' | 'table-cell' | 'metadata';
  originalText: string;
  translatedText?: string;
  metadata?: {
    level?: number;
    isBold?: boolean;
    isItalic?: boolean;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    row?: number;
    col?: number;
    rowSpan?: number;
    colSpan?: number;
    fontSize?: string;
    fontFamily?: string;
  };
}

export interface TranslationState {
  isProcessing: boolean;
  progress: number;
  statusMessage?: string;
  error: string | null;
  originalFileName: string | null;
  originalFileType: string | null;
  originalFileData?: string; // Base64 representation for multimodal OCR
  mimeType?: string;
  chunks: DocumentChunk[];
  sourceLang: string;
  targetLang: string;
  tone: TranslationTone;
  groundingEnabled: boolean;
  glossary: GlossaryItem[];
}

export interface AppState {
  theme: 'light' | 'dark';
}
