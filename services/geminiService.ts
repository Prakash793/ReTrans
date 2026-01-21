
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { DocumentChunk, GlossaryItem, TranslationTone } from "../types";
import { GEMINI_MODEL } from "../constants";

export class GeminiService {
  constructor() {}

  private getClient(): GoogleGenAI {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Translates chunks using the standard text-based batching engine.
   */
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
    
    const abstract = chunks.slice(0, 8).map(c => c.originalText).join(' ').substring(0, 1200);
    
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

  /**
   * Fallback for scanned documents (Vision-OCR mode).
   * It takes the file itself and performs visual translation.
   */
  async translateScannedDocument(
    fileData: string,
    mimeType: string,
    targetLang: string,
    tone: TranslationTone
  ): Promise<DocumentChunk[]> {
    const ai = this.getClient();
    
    const systemInstruction = `You are an elite Vision-OCR translation engine. 
    You have been provided with a document that is either scanned or lacks a text layer.
    
    TASK:
    1. Scan the image/document visually.
    2. Extract all readable text segments.
    3. Translate the content to ${targetLang} using a ${tone} tone.
    4. Maintain the original logical structure (headings, paragraphs).
    
    OUTPUT FORMAT:
    Return a JSON array of objects with this schema: 
    { "type": "heading" | "paragraph", "originalText": "...", "translatedText": "..." }
    `;

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            { inlineData: { data: fileData, mimeType: mimeType } },
            { text: `Please perform a neural OCR scan and translate this document into ${targetLang}.` }
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

      const text = response.text;
      if (!text) throw new Error("Vision engine returned empty results.");
      
      const parsed = JSON.parse(text);
      return parsed.map((item: any, idx: number) => ({
        id: `ocr-${idx}`,
        type: item.type === 'heading' ? 'heading' : 'paragraph',
        originalText: item.originalText,
        translatedText: item.translatedText,
        metadata: { alignment: 'left' }
      }));
    } catch (err) {
      console.error("Multimodal Fallback Error:", err);
      throw new Error("Neural vision scan failed. Ensure document is legible.");
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
    const ai = this.getClient();
    const textToTranslate = batch.map(c => c.originalText);
    
    let glossaryInstruction = "";
    if (glossary.length > 0) {
      const glossaryText = glossary.map(item => `"${item.original}" -> "${item.target}"`).join(', ');
      glossaryInstruction = `\nSTRICT TERMINOLOGY MAPPING: Use: ${glossaryText}.`;
    }

    const toneInstructions: Record<TranslationTone, string> = {
      professional: "Formal, balanced business tone.",
      legal: "Precise legal terminology. Formal syntax.",
      technical: "Precise engineering jargon and measurements.",
      medical: "Clinical accuracy.",
      creative: "Stylistic resonance and brand voice."
    };

    const config: any = {
      systemInstruction: `Enterprise Translation Engine. Tone: ${toneInstructions[tone]}. Abstract Context: ${abstract} ${glossaryInstruction}`,
      temperature: 0,
      thinkingConfig: { thinkingBudget: 2000 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    };

    if (useGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: { parts: [{ text: `Translate: ${JSON.stringify(textToTranslate)} to ${targetLang}` }] },
        config
      });
      const parsed = JSON.parse(response.text || "[]");
      return new Array(batch.length).fill("").map((_, i) => parsed[i] || batch[i].originalText);
    } catch (error: any) {
      return textToTranslate;
    }
  }

  async detectLanguage(sampleText: string): Promise<string> {
    const ai = this.getClient();
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: { parts: [{ text: `ISO 639-1 code for: "${sampleText.substring(0, 400)}"` }] },
        config: { systemInstruction: "Output 2-letter code only." }
      });
      return (response.text || "en").trim().toLowerCase().substring(0, 2);
    } catch (error) { return "en"; }
  }
}

export const geminiService = new GeminiService();
