
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { DocumentChunk, GlossaryItem, TranslationTone } from "../types";
import { GEMINI_MODEL } from "../constants";

export class GeminiService {
  /**
   * Translates text chunks with structural preservation.
   * New GoogleGenAI instance is created per call to ensure up-to-date key injection.
   */
  async translateChunks(
    chunks: DocumentChunk[],
    sourceLang: string,
    targetLang: string,
    tone: TranslationTone,
    useGrounding: boolean = false,
    glossary: GlossaryItem[] = []
  ): Promise<string[]> {
    const BATCH_SIZE = 10;
    const results: string[] = [];
    
    // Create a context abstract to help the model maintain consistency
    const abstract = chunks.slice(0, 15).map(c => c.originalText).join(' ').substring(0, 2000);
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchResults = await this.translateBatch(
        batch, 
        sourceLang, 
        targetLang, 
        tone,
        abstract,
        useGrounding, 
        glossary
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  async translateScannedDocument(
    fileData: string,
    mimeType: string,
    targetLang: string,
    tone: TranslationTone
  ): Promise<DocumentChunk[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = `You are a high-precision Multimodal Document Translation Architect.
    TASK: Mirror the visual and semantic structure of the document image in text.
    
    STRICT COMPLIANCE RULES:
    1. STRUCTURAL FIDELITY: Maintain tables, empty lines, and lists.
    2. CHECKBOXES: Do not skip checkboxes. Represent empty as "☐" and checked as "☑".
    3. NO CONTENT LOSS: Do not skip footers, headers, or small text.
    4. TRANSLATION: Translate content into ${targetLang} while keeping structural markers constant.
    
    OUTPUT:
    JSON array of objects: { "type": "heading" | "paragraph" | "checkbox" | "table-cell", "originalText": "...", "translatedText": "..." }
    `;

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            { inlineData: { data: fileData, mimeType: mimeType } },
            { text: `Translate this entire document structure and content to ${targetLang}. Fidelity is mandatory.` }
          ]
        },
        config: {
          systemInstruction,
          temperature: 0, // Strict fidelity
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                originalText: { type: Type.STRING },
                translatedText: { type: Type.STRING }
              },
              required: ["type", "originalText", "translatedText"]
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || "[]");
      return parsed.map((item: any, idx: number) => ({
        id: `ocr-${idx}`,
        type: item.type === 'checkbox' ? 'checkbox' : (item.type === 'heading' ? 'heading' : (item.type === 'table-cell' ? 'table-cell' : 'paragraph')),
        originalText: item.originalText,
        translatedText: item.translatedText,
        metadata: { 
          alignment: 'left', 
          isCheckbox: item.type === 'checkbox',
          isChecked: item.originalText.includes('☑') || item.originalText.includes('[x]')
        }
      }));
    } catch (err: any) {
      if (err.message?.includes("entity was not found")) throw new Error("API_KEY_NOT_FOUND");
      throw new Error("Neural vision engine failed to map this document structure.");
    }
  }

  private async translateBatch(
    batch: DocumentChunk[],
    sourceLang: string,
    targetLang: string,
    tone: TranslationTone,
    abstract: string,
    useGrounding: boolean,
    glossary: GlossaryItem[]
  ): Promise<string[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const textToTranslate = batch.map(c => {
      if (c.type === 'empty-line') return "---STRUCTURAL_WHITESPACE_MARKER---";
      return c.originalText;
    });
    
    let glossaryInstruction = "";
    if (glossary.length > 0) {
      glossaryInstruction = `\nSTRICT GLOSSARY: ${glossary.map(i => `"${i.original}" must be translated as "${i.target}"`).join(', ')}.`;
    }

    const config: any = {
      systemInstruction: `Enterprise Fidelity Translator.
      MANDATORY RULES:
      1. STRUCTURAL MARKERS: If a segment is "---STRUCTURAL_WHITESPACE_MARKER---", return exactly that.
      2. CHECKBOXES: Do not modify markers like [ ], [x], ☐, ☑.
      3. NO SUMMARIZATION: Every word must be mirrored.
      4. TONE: Use ${tone} tone.
      ${glossaryInstruction}`,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    };

    if (useGrounding) config.tools = [{ googleSearch: {} }];

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: { parts: [{ text: `Context: ${abstract}\n\nSegments to translate to ${targetLang}: ${JSON.stringify(textToTranslate)}` }] },
        config
      });
      const parsed = JSON.parse(response.text || "[]");
      return batch.map((c, i) => {
        if (c.type === 'empty-line') return "";
        const val = parsed[i];
        return val === "---STRUCTURAL_WHITESPACE_MARKER---" ? "" : (val || c.originalText);
      });
    } catch (error: any) {
      const msg = error.message || "";
      if (msg.includes("entity was not found") || msg.includes("API key")) {
        throw new Error(msg);
      }
      return batch.map(c => c.originalText);
    }
  }

  async detectLanguage(sampleText: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: `Identify language (ISO 2-letter code): "${sampleText.substring(0, 300)}"` }] },
        config: { systemInstruction: "Output 2-letter ISO code only. Nothing else." }
      });
      return (response.text || "en").trim().toLowerCase().substring(0, 2);
    } catch (error) { return "en"; }
  }
}

export const geminiService = new GeminiService();
