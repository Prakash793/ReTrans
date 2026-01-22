
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DocumentChunk, GlossaryItem, TranslationTone } from "../types";
import { ENGINES } from "../constants";

export class GeminiService {
  /**
   * Translates text chunks with heavy focus on Real Estate, Legal, and Financial terminology.
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
    const BATCH_SIZE = engine === ENGINES.FLASH ? 12 : 8;
    const results: string[] = [];
    
    // Create a context abstract from the document to help the model understand if it's a Lease or Invoice
    const abstract = chunks
      .filter(c => c.originalText.length > 5)
      .slice(0, 15)
      .map(c => c.originalText)
      .join(' ')
      .substring(0, 1000);
    
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
        throw error;
      }
    }
    
    return results;
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
    const glossaryStr = glossary.length > 0 ? `\nGlossary: ${glossary.map(g => `${g.original}=${g.target}`).join('; ')}` : "";

    // Industry-specific instruction set
    const systemInstruction = `You are a Senior Real Estate Legal Translator specialized in Lease Agreements, Amendments, and Invoices.
    TASK: Translate the provided JSON array from ${sourceLang} to ${targetLang}.
    
    DOMAIN RULES:
    1. TERMINOLOGY: Use precise real estate terms (e.g., 'Lessor/Lessee' instead of 'Owner/Renter', 'Common Area Maintenance', 'Subordination', 'Habitability', 'Quiet Enjoyment').
    2. INVOICES: Maintain exact numerical values, currencies, and line-item structures for real estate billing.
    3. LEGAL TONE: Use a formal ${tone} tone.
    4. STRUCTURE: Exactly ${batch.length} strings in JSON array. Do not merge or split items.
    5. If "---SKIP---", return it.${glossaryStr}`;

    const config: any = {
      systemInstruction,
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    };

    if (useGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: engine,
      contents: { 
        parts: [{ text: `DOCUMENT CONTEXT: ${abstract}\n\nTRANSLATE SEGMENTS: ${JSON.stringify(textSegments)}` }] 
      },
      config
    });

    const parsed = JSON.parse(response.text || "[]");
    return parsed.map((val: string) => (val === "---SKIP---" ? "" : val));
  }

  async detectLanguage(sample: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: ENGINES.FLASH,
        contents: { parts: [{ text: `Identify language (2-letter ISO): "${sample.substring(0, 200)}"` }] },
        config: { systemInstruction: "Output 2-letter ISO code ONLY." }
      });
      return (response.text || "en").trim().toLowerCase().substring(0, 2);
    } catch { return "en"; }
  }
}

export const geminiService = new GeminiService();
