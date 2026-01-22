
import React, { useState, useEffect, useCallback } from 'react';
import { TranslationState, DocumentChunk, TranslationTone } from './types';
import { fileService } from './services/fileService';
import { geminiService } from './services/geminiService';
import { TRANSLATION_TONES, ENGINES } from './constants';
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
  Activity,
  Cpu
} from 'lucide-react';

declare global {
  interface Window {
    // Fix: Using 'any' for aistudio to resolve conflicts with existing global 'AIStudio' type definitions
    // which may have different modifiers or property structures in the environment.
    aistudio: any;
    mammoth: any;
    pdfjsLib: any;
  }
}

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showGlossary, setShowGlossary] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [selectedEngine, setSelectedEngine] = useState<string>(ENGINES.FLASH);
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

  useEffect(() => {
    const checkStatus = async () => {
      const checkLibs = () => {
        const docx = typeof window.mammoth !== 'undefined';
        const pdf = typeof window.pdfjsLib !== 'undefined';
        setLibsReady({ docx, pdf });
        if (!docx || !pdf) setTimeout(checkLibs, 1000);
      };
      checkLibs();

      const envKey = process.env.API_KEY;
      if (envKey && envKey !== 'undefined' && envKey.length > 5) {
        setHasKey(true);
      } else {
        try {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasKey(!!selected);
        } catch (e) {
          setHasKey(false);
        }
      }
    };
    checkStatus();
  }, []);

  const handleKeySelection = async () => {
    try {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      if (state.error?.toLowerCase().includes('key')) setState(p => ({ ...p, error: null }));
    } catch (e) { console.error("Key selection failed"); }
  };

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if ((ext === 'docx' && !libsReady.docx) || (ext === 'pdf' && !libsReady.pdf)) {
      setState(p => ({ ...p, error: "System initialization in progress... please retry." }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      statusMessage: 'Scanning document...',
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
        isProcessing: false,
        statusMessage: 'Document mapped.',
        originalFileType: ext || 'unknown'
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, isProcessing: false, error: err.message }));
    }
  }, [libsReady]);

  const startTranslation = async () => {
    const envKey = process.env.API_KEY;
    if (!envKey || envKey === 'undefined') {
      await handleKeySelection();
      return;
    }

    const isVision = (state.chunks.length === 0 || state.chunks.every(c => !c.originalText.trim())) && state.originalFileData;
    
    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      error: null, 
      statusMessage: isVision ? 'Neural Vision Translation...' : 'Accelerated Context Alignment...' 
    }));
    
    try {
      if (isVision && state.originalFileData) {
        const ocrChunks = await geminiService.translateScannedDocument(
          state.originalFileData,
          state.mimeType || 'application/pdf',
          state.targetLang,
          state.tone,
          selectedEngine
        );
        setState(prev => ({ ...prev, chunks: ocrChunks, isProcessing: false, statusMessage: 'Vision Sync Done' }));
      } else {
        let finalSourceLang = state.sourceLang;
        if (finalSourceLang === 'auto') {
          const sample = state.chunks.slice(0, 3).map(c => c.originalText).join(' ');
          finalSourceLang = await geminiService.detectLanguage(sample);
        }

        const translatedTexts = await geminiService.translateChunks(
          state.chunks,
          finalSourceLang,
          state.targetLang,
          state.tone,
          selectedEngine,
          state.groundingEnabled,
          state.glossary
        );

        const translatedChunks = state.chunks.map((chunk, i) => ({
          ...chunk,
          translatedText: translatedTexts[i] || chunk.originalText
        }));

        setState(prev => ({ ...prev, chunks: translatedChunks, isProcessing: false, statusMessage: 'Neural Sync Done' }));
      }
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      const isAuth = msg.includes("API key") || msg.includes("entity was not found");
      if (isAuth) setHasKey(false);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: isAuth ? "Key Authentication Failure. Please reconnect." : msg, 
        statusMessage: 'Error' 
      }));
    }
  };

  const handleDownloadDoc = (mode: 'original' | 'translated') => {
    const hasContent = mode === 'original' ? state.chunks.length > 0 : state.chunks.some(c => c.translatedText);
    if (!hasContent) return;

    let html = "<html><body>";
    state.chunks.forEach(chunk => {
      const text = mode === 'original' ? chunk.originalText : chunk.translatedText;
      if (chunk.type === 'empty-line') html += "<br/>";
      else if (chunk.type === 'heading') html += `<h2>${text}</h2>`;
      else if (chunk.type === 'checkbox') html += `<p>${chunk.metadata?.isChecked ? '☑' : '☐'} ${text}</p>`;
      else html += `<p>${text}</p>`;
    });
    html += "</body></html>";

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ReTrans_${state.originalFileName}_${mode}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
      <Header theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />
      
      <main className="max-w-7xl mx-auto px-6 py-10">
        {!hasKey && (
          <div className="mb-10 p-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl animate-in slide-in-from-top-4">
            <div className="flex items-center gap-6">
              <div className="bg-amber-600 p-4 rounded-2xl text-white">
                <Key className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Project Key Required</h3>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Connect your <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline">Gemini Project</a> to enable accelerated translation.
                </p>
              </div>
            </div>
            <button 
              onClick={handleKeySelection}
              className="px-10 py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-3"
            >
              Configure API Key <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {state.error && (
          <div className="mb-10 p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-[2rem] flex items-start gap-5 shadow-lg">
            <AlertCircle className="w-6 h-6 text-red-600 mt-1" />
            <div className="flex-1">
              <h4 className="font-bold text-red-900 dark:text-red-100">Translation Halted</h4>
              <p className="text-sm text-red-800 dark:text-red-300">{state.error}</p>
              <div className="mt-4 flex gap-4">
                <button onClick={() => setState(p => ({...p, error: null}))} className="text-xs font-bold text-blue-600 hover:underline uppercase tracking-widest">Dismiss</button>
                <button onClick={() => setSelectedEngine(ENGINES.FLASH)} className="text-xs font-bold text-blue-600 hover:underline uppercase tracking-widest">Switch to Turbo Engine</button>
              </div>
            </div>
          </div>
        )}

        {state.chunks.length === 0 ? (
          <div className="space-y-16 py-12 text-center">
            <div className="max-w-4xl mx-auto space-y-6">
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9]">
                Neural <br/><span className="text-blue-600">Mirroring</span>
              </h1>
              <p className="text-xl text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
                Enterprise translation that respects your layout. Upload documents and get high-fidelity results instantly with Gemini Turbo.
              </p>
            </div>
            
            <div className="relative group max-w-4xl mx-auto">
              {!(libsReady.docx && libsReady.pdf) && (
                <div className="absolute inset-0 z-10 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md flex items-center justify-center rounded-[3rem]">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                </div>
              )}
              <FileUploader onUpload={handleFileUpload} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 animate-in slide-in-from-bottom-8">
            <div className="xl:col-span-12 flex flex-wrap items-center justify-between gap-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-4 px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Output</span>
                  <LanguagePicker value={state.targetLang} onChange={(val) => setState(p => ({ ...p, targetLang: val }))} />
                </div>
                
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                   <button 
                    onClick={() => setSelectedEngine(ENGINES.FLASH)}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedEngine === ENGINES.FLASH ? 'bg-white dark:bg-slate-700 shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     <Zap className="w-3 h-3" /> Turbo
                   </button>
                   <button 
                    onClick={() => setSelectedEngine(ENGINES.PRO)}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedEngine === ENGINES.PRO ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     <Cpu className="w-3 h-3" /> Neural
                   </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowGlossary(true)}
                  className="p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all relative"
                >
                  <Book className="w-6 h-6" />
                  {state.glossary.length > 0 && <span className="absolute top-3 right-3 w-3 h-3 bg-blue-600 rounded-full ring-4 ring-white dark:ring-slate-900"></span>}
                </button>
                <button 
                  onClick={() => setShowSource(!showSource)}
                  className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${showSource ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                >
                  {showSource ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {showSource ? 'Comparison' : 'Result Only'}
                </button>
                <button 
                  onClick={startTranslation}
                  disabled={state.isProcessing}
                  className="flex items-center gap-3 px-10 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/30 transition-all active:scale-95"
                >
                  {state.isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  {state.isProcessing ? 'Mirroring...' : 'Perform Translation'}
                </button>
                <button 
                  onClick={() => handleDownloadDoc('translated')}
                  disabled={!state.chunks.some(c => c.translatedText)}
                  className="p-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl hover:opacity-90 disabled:opacity-20 transition-all shadow-lg active:scale-95"
                  title="Download Result"
                >
                  <RefreshCcw className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className={`${showSource ? 'xl:col-span-6' : 'xl:col-span-12'} transition-all duration-500`}>
               <div className="mb-6 px-4 flex justify-between items-center text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Original Scan</span>
                  <button onClick={() => setState(p => ({...p, chunks: [], originalFileName: null}))} className="text-[10px] font-black uppercase hover:text-rose-600 flex items-center gap-2">
                    <RefreshCcw className="w-3 h-3" /> Clear Session
                  </button>
               </div>
               <DocumentPreview chunks={state.chunks} mode="original" />
            </div>

            {showSource && (
              <div className="xl:col-span-6 animate-in slide-in-from-right-12 duration-700">
                <div className="mb-6 px-4 flex justify-between items-center text-blue-600">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">{selectedEngine === ENGINES.FLASH ? 'Turbo Translation' : 'Neural Alignment'}</span>
                  </div>
                  {state.isProcessing && (
                    <div className="flex items-center gap-2">
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
