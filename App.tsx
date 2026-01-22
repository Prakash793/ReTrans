
import React, { useState, useEffect } from 'react';
import { TranslationState, DocumentChunk, TranslationTone } from './types';
import { fileService } from './services/fileService';
import { geminiService } from './services/geminiService';
import { TRANSLATION_TONES, GEMINI_MODEL } from './constants';
import Header from './components/Header';
import Footer from './components/Footer';
import LanguagePicker from './components/LanguagePicker';
import DocumentPreview from './components/DocumentPreview';
import FileUploader from './components/FileUploader';
import GlossaryManager from './components/GlossaryManager';
import { 
  Globe, 
  ArrowRight, 
  Download, 
  Loader2, 
  Book, 
  Type, 
  FileText, 
  AlertCircle, 
  ChevronDown,
  Eye,
  EyeOff,
  CheckCircle2,
  Key,
  ExternalLink,
  ShieldCheck,
  ScanText,
  AlertTriangle,
  RefreshCcw,
  Zap
} from 'lucide-react';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Completed the truncated App component and added missing logic and default export.
const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showGlossary, setShowGlossary] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  
  const [state, setState] = useState<TranslationState>({
    isProcessing: false,
    progress: 0,
    statusMessage: '',
    error: null,
    originalFileName: null,
    originalFileType: null,
    chunks: [],
    sourceLang: 'auto',
    targetLang: 'en',
    tone: 'professional',
    groundingEnabled: false,
    glossary: [],
  });

  useEffect(() => {
    const initKeyCheck = async () => {
      // Priority 1: Check for valid Gemini prefix (AIza...)
      const currentKey = process.env.API_KEY || '';
      if (currentKey.startsWith('AIza')) {
        setHasKey(true);
        return;
      }
      
      // Priority 2: Standard platform check
      try {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } catch (e) {
        setHasKey(false);
      }
    };
    initKeyCheck();
  }, [state.error]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleSource = () => setShowSource(prev => !prev);

  const handleKeySelection = async () => {
    try {
      await window.aistudio.openSelectKey();
      // Assume success immediately to allow the user to proceed to the app logic.
      setHasKey(true);
      if (state.error) setState(p => ({ ...p, error: null }));
    } catch (e) {
      console.error("Key selection failed");
    }
  };

  const handleFileUpload = async (file: File) => {
    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      progress: 10, 
      statusMessage: 'Scanning Layout Fidelity...',
      error: null, 
      originalFileName: file.name 
    }));
    try {
      const processed = await fileService.processFile(file);
      setState(prev => ({ 
        ...prev, 
        chunks: processed.chunks, 
        originalFileData: processed.fileData,
        mimeType: processed.mimeType,
        progress: 30,
        statusMessage: processed.chunks.length > 0 ? 'Document Mapped.' : 'Vision Engine Prime.',
        isProcessing: false,
        originalFileType: file.name.split('.').pop() || 'pdf'
      }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: `Structure Error: ${err.message}`, 
        statusMessage: 'Fail.' 
      }));
    }
  };

  const startTranslation = async () => {
    const currentKey = process.env.API_KEY || '';
    
    // Diagnostic Block: Detect OpenAI key strings (Common User Error)
    if (currentKey.startsWith('sk-')) {
      setState(prev => ({ 
        ...prev, 
        error: "Engine Conflict: An OpenAI key (sk-...) was detected. ReTrans is built on the Google Gemini SDK. Please select a Google Gemini API key (starts with AIza) to proceed."
      }));
      setHasKey(false);
      return;
    }

    if (!currentKey || currentKey === 'undefined' || currentKey.length < 5) {
      await handleKeySelection();
      // Continue execution to let the platform injection happen.
    }

    const isImageBased = (state.chunks.length === 0 || state.chunks.every(c => !c.originalText.trim())) && state.originalFileData;
    
    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      error: null, 
      progress: 40, 
      statusMessage: isImageBased ? 'Fidelity Vision Scan...' : 'Neural Mirror Alignment...' 
    }));
    
    try {
      if (isImageBased && state.originalFileData) {
        const ocrChunks = await geminiService.translateScannedDocument(
          state.originalFileData,
          state.mimeType || 'application/pdf',
          state.targetLang,
          state.tone
        );
        setState(prev => ({
          ...prev,
          chunks: ocrChunks,
          isProcessing: false,
          progress: 100,
          statusMessage: 'Vision Optimized.'
        }));
      } else {
        let finalSourceLang = state.sourceLang;
        if (finalSourceLang === 'auto') {
          const sampleText = state.chunks.slice(0, 3).map(c => c.originalText).join(' ');
          finalSourceLang = await geminiService.detectLanguage(sampleText);
        }

        const translatedTexts = await geminiService.translateChunks(
          state.chunks,
          finalSourceLang,
          state.targetLang,
          state.tone,
          state.groundingEnabled,
          state.glossary
        );

        const translatedChunks = state.chunks.map((chunk, i) => ({
          ...chunk,
          translatedText: translatedTexts[i] || chunk.originalText
        }));

        setState(prev => ({
          ...prev,
          chunks: translatedChunks,
          isProcessing: false,
          progress: 100,
          statusMessage: 'Fidelity Translation Ready.'
        }));
      }
    } catch (err: any) {
      const msg = err.message || "";
      const isEntityError = msg.includes("Requested entity was not found") || msg.includes("not found");
      const isAuthError = msg.includes("API key") || msg.includes("API_KEY_NOT_FOUND");

      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: isEntityError 
          ? "The requested neural model (" + GEMINI_MODEL + ") is unavailable. This typically means the API key used is from a different provider or project region." 
          : (isAuthError ? "Google Gemini authentication failed. Verify you are using a Gemini API Key from a paid project." : msg), 
        progress: 0, 
        statusMessage: 'Engine Fault.' 
      }));
    }
  };

  const handleDownloadDoc = (mode: 'original' | 'translated') => {
    const hasContent = mode === 'original' 
      ? state.chunks.length > 0 
      : state.chunks.some(c => c.translatedText);
      
    if (!hasContent) return;

    let contentHtml = "";
    state.chunks.forEach(chunk => {
      const text = mode === 'original' ? chunk.originalText : chunk.translatedText;
      if (chunk.type === 'empty-line') {
        contentHtml += "<br/>";
      } else if (chunk.type === 'heading') {
        contentHtml += `<h${chunk.metadata?.level || 1}>${text}</h${chunk.metadata?.level || 1}>`;
      } else if (chunk.type === 'checkbox') {
        const mark = chunk.metadata?.isChecked ? "☑" : "☐";
        contentHtml += `<p><span class="checkbox">${mark}</span> ${text}</p>`;
      } else {
        contentHtml += `<p>${text}</p>`;
      }
    });

    const htmlHeader = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          body { font-family: 'Segoe UI', sans-serif; line-height: 1.5; color: #1a202c; padding: 40px; }
          h1, h2, h3, h4, h5, h6 { font-size: 14pt; font-weight: bold; margin-bottom: 12pt; color: #000; }
          p { margin-bottom: 11pt; text-align: justify; font-size: 11pt; }
          table { border-collapse: collapse; width: 100%; margin: 15pt 0; border: 1.5pt solid #cbd5e0; }
          td, th { border: 1pt solid #cbd5e0; padding: 12pt; font-size: 10pt; vertical-align: top; }
          .bold { font-weight: bold; }
          .italic { font-style: italic; }
          .underline { text-decoration: underline; text-underline-offset: 2pt; }
          .checkbox { font-family: 'Segoe UI Symbol', sans-serif; }
        </style>
      </head>
      <body>
        ${contentHtml}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlHeader], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${mode === 'original' ? 'Original' : 'Translated'}_${state.originalFileName || 'Document'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors`}>
      <Header theme={theme} toggleTheme={toggleTheme} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!hasKey && (
          <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-amber-100 dark:bg-amber-900/50 p-3 rounded-xl text-amber-600 dark:text-amber-400">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-amber-900 dark:text-amber-100">API Configuration Required</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Select a Google Gemini API key to enable document translation services.
                </p>
              </div>
            </div>
            <button 
              onClick={handleKeySelection}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2"
            >
              Configure API Key <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {state.error && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{state.error}</p>
              {state.error.includes("entity was not found") && (
                <button 
                  onClick={handleKeySelection}
                  className="mt-2 text-xs font-bold text-red-600 dark:text-red-400 underline hover:no-underline"
                >
                  Change API Key Connection
                </button>
              )}
            </div>
          </div>
        )}

        {state.chunks.length === 0 ? (
          <div className="space-y-12 py-10">
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                Structural Document <span className="text-blue-600">Translation</span>
              </h1>
              <p className="text-lg text-slate-500 dark:text-slate-400">
                Preserve layout, tables, and checkboxes with neural-vision accuracy. 
                Upload a PDF, DOCX, or TXT to begin.
              </p>
            </div>
            <FileUploader onUpload={handleFileUpload} />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-12 flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Target</span>
                  <LanguagePicker value={state.targetLang} onChange={(val) => setState(p => ({ ...p, targetLang: val }))} />
                </div>
                
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tone</span>
                  <select 
                    value={state.tone} 
                    onChange={(e) => setState(p => ({ ...p, tone: e.target.value as TranslationTone }))}
                    className="bg-transparent border-none focus:ring-0 font-semibold text-sm cursor-pointer"
                  >
                    {TRANSLATION_TONES.map(t => (
                      <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowGlossary(true)}
                  className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
                  title="Glossary"
                >
                  <Book className="w-5 h-5" />
                  {state.glossary.length > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </button>
                
                <button 
                  onClick={toggleSource}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${showSource ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                >
                  {showSource ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {showSource ? 'Hide Source' : 'Show Source'}
                </button>

                <button 
                  onClick={startTranslation}
                  disabled={state.isProcessing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-all"
                >
                  {state.isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {state.isProcessing ? 'Processing...' : 'Translate'}
                </button>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>

                <button 
                  onClick={() => handleDownloadDoc('translated')}
                  disabled={!state.chunks.some(c => c.translatedText)}
                  className="p-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl hover:opacity-90 disabled:opacity-30 transition-all"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className={`${showSource ? 'xl:col-span-6' : 'xl:col-span-12'} transition-all duration-500`}>
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Original Content</span>
                </div>
                <button 
                  onClick={() => setState(p => ({ ...p, chunks: [], originalFileName: null }))}
                  className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                  <RefreshCcw className="w-3 h-3" /> Start Over
                </button>
              </div>
              <DocumentPreview chunks={state.chunks} mode="original" />
            </div>

            {showSource && (
              <div className="xl:col-span-6 animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                    <span className="text-xs font-black uppercase tracking-widest text-blue-600">Translated Neural Output</span>
                  </div>
                  {state.isProcessing && (
                    <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded-full">
                      {state.statusMessage}
                    </span>
                  )}
                </div>
                <DocumentPreview chunks={state.chunks} mode="translated" />
              </div>
            )}
          </div>
        )}
      </main>

      {showGlossary && (
        <GlossaryManager 
          glossary={state.glossary} 
          onChange={(g) => setState(p => ({ ...p, glossary: g }))}
          onClose={() => setShowGlossary(false)}
        />
      )}
      
      <Footer />
    </div>
  );
};

export default App;
