
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { DocumentChunk, GlossaryItem, TranslationTone } from "../types";
import { ENGINES } from "../constants";

export class GeminiService {
  /**
   * Translates text chunks with structural preservation using specified engine.
   */
  async translateChunks(
    chunks: DocumentChunk[],
    sourceLang: string,
    targetLang: string,
    tone: TranslationTone,
    engine: string = ENGINES.FLASH,
    useGrounding: boolean = false,
    glossary: GlossaryItem[] = []
  ): Promise<string[]> {
    // Flash can handle larger batches, Pro smaller.
    const BATCH_SIZE = engine === ENGINES.FLASH ? 12 : 8;
    const results: string[] = [];
    
    // Abstract for context
    const abstract = chunks
      .filter(c => c.originalText.length > 5)
      .slice(0, 15)
      .map(c => c.originalText)
      .join(' ')
      .substring(0, 800);
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      try {
        const batchResults = await this.translateBatch(
          batch, 
          sourceLang, 
          targetLang, 
          tone,
          engine,
          abstract,
          useGrounding, 
          glossary
        );
        results.push(...batchResults);
      } catch (error: any) {
        console.error(`Batch ${i} engine failure:`, error);
        throw error;
      }
    }
    
    return results;
  }

  async translateScannedDocument(
    fileData: string,
    mimeType: string,
    targetLang: string,
    tone: TranslationTone,
    engine: string = ENGINES.PRO // Default to Pro for OCR/Vision for better accuracy
  ): Promise<DocumentChunk[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = `You are a high-precision Document Layout Architect.
    TASK: Mirror the document image in text while translating to ${targetLang}.
    
    RULES:
    1. MIRROR STRUCTURE: Preserve tables, headers, and footers.
    2. CHECKBOXES: Use "☐" for unchecked and "☑" for checked.
    3. JSON ONLY: Your entire output must be a single valid JSON array.
    
    SCHEMA: [{ "type": "paragraph" | "heading" | "checkbox", "original": "...", "translated": "..." }]`;

    try {
      const response = await ai.models.generateContent({
        model: engine,
        contents: {
          parts: [
            { inlineData: { data: fileData, mimeType: mimeType } },
            { text: `Reconstruct and translate this document into ${targetLang} using ${tone} tone.` }
          ]
        },
        config: {
          systemInstruction,
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                original: { type: Type.STRING },
                translated: { type: Type.STRING }
              },
              required: ["type", "original", "translated"]
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || "[]");
      return parsed.map((item: any, idx: number) => ({
        id: `ocr-${idx}`,
        type: item.type === 'checkbox' ? 'checkbox' : (item.type === 'heading' ? 'heading' : 'paragraph'),
        originalText: item.original,
        translatedText: item.translated,
        metadata: { 
          isCheckbox: item.type === 'checkbox',
          isChecked: item.original.includes('☑') || item.original.toLowerCase().includes('[x]')
        }
      }));
    } catch (err: any) {
      throw new Error(`Vision Engine Failure: ${err.message}`);
    }
  }

  private async translateBatch(
    batch: DocumentChunk[],
    sourceLang: string,
    targetLang: string,
    tone: TranslationTone,
    engine: string,
    abstract: string,
    useGrounding: boolean,
    glossary: GlossaryItem[]
  ): Promise<string[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const textSegments = batch.map(c => c.type === 'empty-line' ? "---SKIP---" : c.originalText);
    
    const glossaryStr = glossary.length > 0 
      ? `\nGlossary: ${glossary.map(g => `${g.original}=${g.target}`).join('; ')}`
      : "";

    const response = await ai.models.generateContent({
      model: engine,
      contents: { 
        parts: [{ text: `Context: ${abstract}\n\nSegments: ${JSON.stringify(textSegments)}` }] 
      },
      config: {
        systemInstruction: `You are a professional ${tone} translator. 
        TASK: Translate JSON array from ${sourceLang} to ${targetLang}.
        RULES: 
        1. Output: Return exactly ${batch.length} translated strings in a JSON array.
        2. Preservation: If segment is "---SKIP---", return it unchanged.
        3. Symbols: Keep [ ], [x], ☐, ☑ markers.${glossaryStr}`,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    if (!Array.isArray(parsed) || parsed.length !== batch.length) {
      throw new Error("Synchronization Error: Model returned malformed batch.");
    }

    return parsed.map((val, i) => (val === "---SKIP---" ? "" : val));
  }

  async detectLanguage(sample: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: ENGINES.FLASH,
        contents: { parts: [{ text: `Lang ID: "${sample.substring(0, 200)}"` }] },
        config: { systemInstruction: "Output 2-letter ISO code only." }
      });
      return (response.text || "en").trim().toLowerCase().substring(0, 2);
    } catch { return "en"; }
  }
}

export const geminiService = new GeminiService();
