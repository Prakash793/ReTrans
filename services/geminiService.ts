
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { DocumentChunk, GlossaryItem, TranslationTone } from "../types";
import { GEMINI_MODEL } from "../constants";

export class GeminiService {
  async translateChunks(
    chunks: DocumentChunk[],
    sourceLang: string,
    targetLang: string,
    tone: TranslationTone,
    useGrounding: boolean = false,
    glossary: GlossaryItem[] = []
  ): Promise<string[]> {
    const BATCH_SIZE = 12;
    const results: string[] = [];
    
    const abstract = chunks.slice(0, 10).map(c => c.originalText).join(' ').substring(0, 1500);
    
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
    // Re-initialize client right before call per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = `You are a specialized Multimodal Document Translation Architect.
    TASK: Mirror the provided image perfectly in text.
    
    CRITICAL RULES:
    1. EXTRACT ALL ELEMENTS: Tables, bullet points, and Checkboxes must be preserved.
    2. CHECKBOXES: Represent empty checkboxes as "☐" and checked ones as "☑".
    3. NO CONTENT LOSS: Do not skip small text or footers.
    4. STRUCTURE: Identify headers, paragraphs, and list items.
    
    OUTPUT:
    JSON array: { "type": "heading" | "paragraph" | "checkbox", "originalText": "...", "translatedText": "..." }
    `;

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            { inlineData: { data: fileData, mimeType: mimeType } },
            { text: `Translate this document structure to ${targetLang}. Preserve all checkboxes and form elements.` }
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
        type: item.type === 'checkbox' ? 'checkbox' : (item.type === 'heading' ? 'heading' : 'paragraph'),
        originalText: item.originalText,
        translatedText: item.translatedText,
        metadata: { alignment: 'left', isCheckbox: item.type === 'checkbox' }
      }));
    } catch (err: any) {
      if (err.message?.includes("entity was not found")) throw new Error("API_KEY_NOT_FOUND");
      throw new Error("Vision neural scan failed.");
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
    // Re-initialize client right before call per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Filter out truly empty chunks but keep placeholders
    const textToTranslate = batch.map(c => c.type === 'empty-line' ? "---EMPTY_LINE---" : c.originalText);
    
    let glossaryInstruction = "";
    if (glossary.length > 0) {
      glossaryInstruction = `\nGLOSSARY: ${glossary.map(i => `"${i.original}" -> "${i.target}"`).join(', ')}.`;
    }

    const config: any = {
      systemInstruction: `High-Fidelity Enterprise Translator.
      RULES:
      1. PRESERVE STRUCTURAL MARKERS: If a text contains [ ] or [x] or checkboxes, keep them exactly as is in the translated string.
      2. MIRROR FORMATTING: Do not add or remove periods/puncutation from the original.
      3. EMPTY LINES: If you see "---EMPTY_LINE---", return exactly "---EMPTY_LINE---".
      4. TONE: Use ${tone} tone.
      ${glossaryInstruction}`,
      temperature: 0,
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
        contents: { parts: [{ text: `Context: ${abstract}\n\nTranslate these segments to ${targetLang}: ${JSON.stringify(textToTranslate)}` }] },
        config
      });
      const parsed = JSON.parse(response.text || "[]");
      return batch.map((c, i) => {
        if (c.type === 'empty-line') return "";
        return parsed[i] === "---EMPTY_LINE---" ? "" : (parsed[i] || c.originalText);
      });
    } catch (error: any) {
      if (error.message?.includes("entity was not found")) throw new Error("API_KEY_NOT_FOUND");
      return batch.map(c => c.originalText);
    }
  }

  async detectLanguage(sampleText: string): Promise<string> {
    // Re-initialize client right before call per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        // Use flash model for basic tasks like language detection
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: `Identify language for: "${sampleText.substring(0, 300)}"` }] },
        config: { systemInstruction: "Output 2-letter ISO code only." }
      });
      return (response.text || "en").trim().toLowerCase().substring(0, 2);
    } catch (error) { return "en"; }
  }
}

export const geminiService = new GeminiService();
