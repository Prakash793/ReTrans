
import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowRight, 
  Loader2, 
  Book, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Key, 
  RefreshCcw, 
  Zap,
  CheckCircle2,
  FileWarning
} from 'lucide-react';

// Define the AIStudio interface to match environmental requirements
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    // FIX: Making aistudio optional ensures it matches the modifiers of the system's global declaration
    aistudio?: AIStudio;
    mammoth: any;
    pdfjsLib: any;
  }
}

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showGlossary, setShowGlossary] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [hasKey, setHasKey] = useState<boolean>(true); // Default to true to keep UI accessible
  const [libsReady, setLibsReady] = useState<{docx: boolean, pdf: boolean}>({ docx: false, pdf: false });
  
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

  // Verify Environment & Libraries
  useEffect(() => {
    const init = async () => {
      // Check Libraries with polling
      const checkLibs = () => {
        const docx = typeof window.mammoth !== 'undefined';
        const pdf = typeof window.pdfjsLib !== 'undefined';
        setLibsReady({ docx, pdf });
        if (!docx || !pdf) setTimeout(checkLibs, 1000);
      };
      checkLibs();

      // Check Key Status
      try {
        // Safe access to injected platform object
        const selected = await window.aistudio?.hasSelectedApiKey();
        if (selected !== undefined) {
          setHasKey(selected);
        } else {
          checkEnvKey();
        }
      } catch (e) {
        checkEnvKey();
      }
    };

    const checkEnvKey = () => {
      if (process.env.API_KEY && process.env.API_KEY !== 'undefined') {
        setHasKey(true);
      } else {
        setHasKey(false);
      }
    };

    init();
  }, []);

  const handleKeySelection = async () => {
    try {
      // Safe access to injected platform object
      await window.aistudio?.openSelectKey();
      // Mandatory: Assume success immediately to avoid race condition delays
      setHasKey(true);
      if (state.error?.includes("API")) setState(p => ({ ...p, error: null }));
    } catch (e) {
      console.error("Platform key selection failed to open");
    }
  };

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    // Validate engine readiness for specific file type
    if (ext === 'docx' && !libsReady.docx) {
      setState(p => ({ ...p, error: "Word engine (Mammoth) is still loading. Please retry in 2 seconds." }));
      return;
    }
    if (ext === 'pdf' && !libsReady.pdf) {
      setState(p => ({ ...p, error: "PDF engine (PDF.js) is still loading. Please retry in 2 seconds." }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      progress: 10, 
      statusMessage: 'Reading structural metadata...',
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
        statusMessage: 'Document map generated.',
        isProcessing: false,
        originalFileType: ext || 'unknown'
      }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: `Upload Failed: ${err.message}`, 
        statusMessage: 'Error.' 
      }));
    }
  }, [libsReady]);

  const startTranslation = async () => {
    const currentKey = process.env.API_KEY || '';
    if (!currentKey || currentKey === 'undefined') {
      await handleKeySelection();
      return;
    }

    const isVisionMode = (state.chunks.length === 0 || state.chunks.every(c => !c.originalText.trim())) && state.originalFileData;
    
    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      error: null, 
      progress: 40, 
      statusMessage: isVisionMode ? 'Running Neural Vision OCR...' : 'Aligning linguistic context...' 
    }));
    
    try {
      if (isVisionMode && state.originalFileData) {
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
          statusMessage: 'Neural Scan Complete.'
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
          statusMessage: 'Translation Finalized.'
        }));
      }
    } catch (err: any) {
      const msg = err.message || "Unknown engine fault";
      const isAuthError = msg.includes("API key") || msg.includes("entity was not found");
      
      if (isAuthError) setHasKey(false);

      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: isAuthError ? "Authentication Error: Please re-select your Gemini API Key." : msg, 
        progress: 0, 
        statusMessage: 'Halted.' 
      }));
    }
  };

  const handleDownloadDoc = (mode: 'original' | 'translated') => {
    const hasContent = mode === 'original' ? state.chunks.length > 0 : state.chunks.some(c => c.translatedText);
    if (!hasContent) return;

    let html = "";
    state.chunks.forEach(chunk => {
      const text = mode === 'original' ? chunk.originalText : chunk.translatedText;
      if (chunk.type === 'empty-line') html += "<br/>";
      else if (chunk.type === 'heading') html += `<h2>${text}</h2>`;
      else if (chunk.type === 'checkbox') html += `<p>${chunk.metadata?.isChecked ? '[X]' : '[ ]'} ${text}</p>`;
      else html += `<p>${text}</p>`;
    });

    const blob = new Blob(['\ufeff', `<html><body>${html}</body></html>`], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ReTrans_${state.originalFileName}_${mode}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isReadyToProcess = libsReady.docx && libsReady.pdf;

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
      <Header theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />
      
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* API Key Configuration Banner */}
        {!hasKey && (
          <div className="mb-10 p-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-900/50 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-6">
              <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg">
                <Key className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Gemini API Connection Required</h3>
                <p className="text-slate-600 dark:text-slate-400 mt-1 max-w-lg">
                  ReTrans translates via the Google AI Studio platform. Click the button to select an existing project key. No manual typing required.
                </p>
              </div>
            </div>
            <button 
              onClick={handleKeySelection}
              className="group relative px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/30 transition-all active:scale-95 flex items-center gap-3 overflow-hidden"
            >
              <span className="relative z-10">Configure API Key</span>
              <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          </div>
        )}

        {state.error && (
          <div className="mb-10 p-6 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-[2rem] flex items-start gap-5 shadow-lg animate-in zoom-in-95">
            <div className="bg-rose-100 dark:bg-rose-900/40 p-2 rounded-lg">
              <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-rose-900 dark:text-rose-100 uppercase text-xs tracking-widest mb-1">Engine Alert</h4>
              <p className="text-sm text-rose-800 dark:text-rose-300 font-medium">{state.error}</p>
              <div className="mt-4 flex gap-4">
                <button onClick={() => setState(p => ({...p, error: null}))} className="text-xs font-black text-rose-600 dark:text-rose-400 hover:underline">Dismiss</button>
                <button onClick={handleKeySelection} className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline">Reconnect API</button>
              </div>
            </div>
          </div>
        )}

        {state.chunks.length === 0 ? (
          <div className="space-y-16 py-12 text-center animate-in fade-in duration-1000">
            <div className="max-w-4xl mx-auto space-y-6">
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9]">
                Structural <br/><span className="text-blue-600">Translation</span>
              </h1>
              <p className="text-xl text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-2xl mx-auto">
                Next-gen document mirroring. Upload any PDF or Word file to translate content while keeping your precise visual layout intact.
              </p>
            </div>
            
            <div className="relative group max-w-4xl mx-auto">
              {!isReadyToProcess && (
                <div className="absolute inset-0 z-10 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md flex items-center justify-center rounded-[3rem] border border-white/20">
                  <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                    <div className="text-center">
                      <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">Priming Neural Engines</p>
                      <div className="mt-2 flex gap-2 justify-center">
                         <div className={`w-2 h-2 rounded-full ${libsReady.docx ? 'bg-green-500' : 'bg-slate-300 animate-pulse'}`}></div>
                         <div className={`w-2 h-2 rounded-full ${libsReady.pdf ? 'bg-green-500' : 'bg-slate-300 animate-pulse'}`}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <FileUploader onUpload={handleFileUpload} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 animate-in slide-in-from-bottom-8 duration-700">
            {/* Control Bar */}
            <div className="xl:col-span-12 flex flex-wrap items-center justify-between gap-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-4 px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Output</span>
                  <LanguagePicker value={state.targetLang} onChange={(val) => setState(p => ({ ...p, targetLang: val }))} />
                </div>
                <div className="hidden md:flex items-center gap-4 px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tone</span>
                  <select 
                    value={state.tone} 
                    onChange={(e) => setState(p => ({ ...p, tone: e.target.value as TranslationTone }))}
                    className="bg-transparent border-none focus:ring-0 font-bold text-sm cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    {TRANSLATION_TONES.map(t => (
                      <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowGlossary(true)}
                  className="p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all relative"
                >
                  <Book className="w-6 h-6" />
                  {state.glossary.length > 0 && <span className="absolute top-3 right-3 w-3 h-3 bg-blue-600 rounded-full ring-4 ring-white dark:ring-slate-900"></span>}
                </button>
                <button 
                  onClick={() => setShowSource(!showSource)}
                  className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${showSource ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                >
                  {showSource ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {showSource ? 'Split View' : 'Focus Mode'}
                </button>
                <button 
                  onClick={startTranslation}
                  disabled={state.isProcessing}
                  className="flex items-center gap-3 px-10 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/30 transition-all active:scale-95"
                >
                  {state.isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {state.isProcessing ? 'Mirroring...' : 'Translate'}
                </button>
                <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>
                <button 
                  onClick={() => handleDownloadDoc('translated')}
                  disabled={!state.chunks.some(c => c.translatedText)}
                  className="p-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl hover:opacity-90 disabled:opacity-20 transition-all shadow-lg active:scale-95"
                >
                  <RefreshCcw className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Document Preview Area */}
            <div className={`${showSource ? 'xl:col-span-6' : 'xl:col-span-12'} transition-all duration-500`}>
               <div className="mb-6 px-4 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Source Structural Integrity</span>
                  <button onClick={() => setState(p => ({...p, chunks: [], originalFileName: null}))} className="text-[10px] font-black uppercase text-slate-400 hover:text-rose-600 flex items-center gap-2">
                    <RefreshCcw className="w-3 h-3" /> Reset Session
                  </button>
               </div>
               <DocumentPreview chunks={state.chunks} mode="original" />
            </div>

            {showSource && (
              <div className="xl:col-span-6 animate-in slide-in-from-right-12 duration-700">
                <div className="mb-6 px-4 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Neural Contextual Alignment</span>
                  {state.isProcessing && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full border border-blue-100 dark:border-blue-800">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-[9px] font-black uppercase tracking-widest">{state.statusMessage}</span>
                    </div>
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
