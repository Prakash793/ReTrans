
import React, { useState, useEffect, useCallback } from 'react';
import { TranslationState, DocumentChunk } from './types';
import { fileService } from './services/fileService';
import { geminiService } from './services/geminiService';
import { ENGINES } from './constants';
import Header from './components/Header';
import Footer from './components/Footer';
import LanguagePicker from './components/LanguagePicker';
import DocumentPreview from './components/DocumentPreview';
import FileUploader from './components/FileUploader';
import GlossaryManager from './components/GlossaryManager';
import { 
  Loader2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  RefreshCcw, 
  Zap,
  Download,
  CheckCircle2,
  Building,
  ShieldCheck
} from 'lucide-react';

declare global {
  interface Window {
    mammoth: any;
    pdfjsLib: any;
  }
}

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showSource, setShowSource] = useState(true);
  const [selectedEngine] = useState<string>(ENGINES.PRO); // Default to PRO for Real Estate precision
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
    tone: 'legal', // Default to Legal for Real Estate
    groundingEnabled: false,
    glossary: [],
  });

  // Simple library initialization check
  useEffect(() => {
    const checkLibs = () => {
      const docx = typeof window.mammoth !== 'undefined';
      const pdf = typeof window.pdfjsLib !== 'undefined';
      setLibsReady({ docx, pdf });
      if (!docx || !pdf) setTimeout(checkLibs, 500);
    };
    checkLibs();
  }, []);

  const performTranslation = async (currentChunks: DocumentChunk[], targetLang: string) => {
    setState(prev => ({ ...prev, isProcessing: true, statusMessage: 'Analyzing Real Estate Terms...' }));

    try {
      let finalSourceLang = state.sourceLang;
      if (finalSourceLang === 'auto') {
        const sample = currentChunks.slice(0, 3).map(c => c.originalText).join(' ');
        finalSourceLang = await geminiService.detectLanguage(sample);
      }

      const translatedTexts = await geminiService.translateChunks(
        currentChunks,
        finalSourceLang,
        targetLang,
        state.tone,
        selectedEngine,
        state.groundingEnabled,
        state.glossary
      );

      const translatedChunks = currentChunks.map((chunk, i) => ({
        ...chunk,
        translatedText: translatedTexts[i] || chunk.originalText
      }));

      setState(prev => ({ 
        ...prev, 
        chunks: translatedChunks, 
        isProcessing: false, 
        statusMessage: 'Translation Optimized' 
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, isProcessing: false, error: err.message || "Translation failed. Please try again." }));
    }
  };

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    // Check libraries at runtime
    if ((ext === 'docx' && !libsReady.docx) || (ext === 'pdf' && !libsReady.pdf)) {
      setState(p => ({ ...p, error: "Engines are warming up... Please try again in a few seconds." }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      statusMessage: 'Extracting Clauses...',
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
        originalFileType: ext || 'unknown'
      }));
      
      await performTranslation(processed.chunks, state.targetLang);
    } catch (err: any) {
      setState(prev => ({ ...prev, isProcessing: false, error: err.message || "File processing failed." }));
    }
  }, [libsReady, state.targetLang]);

  const handleDownloadDoc = () => {
    const translatedExists = state.chunks.some(c => c.translatedText);
    if (!translatedExists) return;

    let html = "<html><head><meta charset='UTF-8'><style>body{font-family:serif;padding:40px;line-height:1.5;}h2{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;}p{margin-bottom:15px;}</style></head><body>";
    state.chunks.forEach(chunk => {
      const text = chunk.translatedText || "";
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
    link.download = `Translated_${state.originalFileName}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setState(prev => ({
      ...prev,
      chunks: [],
      originalFileName: null,
      error: null,
      statusMessage: ''
    }));
  };

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
      <Header theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />
      
      <main className="max-w-7xl mx-auto px-6 py-10">
        {state.error && (
          <div className="mb-10 p-6 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-[2rem] flex items-start gap-5 shadow-lg animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-6 h-6 text-rose-600 mt-1" />
            <div className="flex-1">
              <h4 className="font-bold text-rose-900 dark:text-rose-100 uppercase tracking-tighter">System Alert</h4>
              <p className="text-sm text-rose-800 dark:text-rose-300">{state.error}</p>
              <button onClick={() => setState(p => ({...p, error: null}))} className="mt-3 text-xs font-black text-rose-600 hover:underline uppercase tracking-widest">Dismiss</button>
            </div>
          </div>
        )}

        {state.chunks.length === 0 ? (
          <div className="space-y-16 py-12 text-center animate-in fade-in duration-700">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 shadow-sm">
                <ShieldCheck className="w-3 h-3" />
                Real Estate Precision Protocol Active
              </div>
              <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.8] mb-10">
                Asset <br/><span className="text-indigo-600">Sync.</span>
              </h1>
              <p className="text-xl text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
                Automated translation for <span className="text-slate-900 dark:text-slate-100 font-bold">Lease Contracts, Amendments, and Invoices</span> with domain-aware structural integrity.
              </p>
            </div>
            
            <FileUploader onUpload={handleFileUpload} />

            <div className="flex flex-col items-center gap-4 text-slate-400">
               <span className="text-[10px] font-black uppercase tracking-[0.5em]">Global Output Language</span>
               <div className="p-4 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl flex items-center gap-4">
                  <LanguagePicker value={state.targetLang} onChange={(val) => setState(p => ({ ...p, targetLang: val }))} />
               </div>
            </div>
          </div>
        ) : (
          <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
            {/* Action Bar */}
            <div className="sticky top-24 z-40 flex flex-wrap items-center justify-between gap-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl">
              <div className="flex items-center gap-6">
                <button 
                  onClick={reset}
                  className="p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-500"
                  title="New Translation"
                >
                  <RefreshCcw className="w-6 h-6" />
                </button>
                <div className="h-10 w-[2px] bg-slate-200 dark:bg-slate-800 hidden md:block"></div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Processing File</span>
                  <span className="font-bold text-sm truncate max-w-[200px]">{state.originalFileName}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-1 justify-center">
                 <div className="flex items-center gap-4 px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <LanguagePicker value={state.targetLang} onChange={(val) => {
                      setState(p => ({ ...p, targetLang: val }));
                      performTranslation(state.chunks, val);
                    }} />
                 </div>
                 
                 <div className="flex items-center gap-3 px-6 py-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                    {state.isProcessing ? (
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                      {state.statusMessage}
                    </span>
                 </div>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowSource(!showSource)}
                  className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${showSource ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600'}`}
                >
                  {showSource ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  Clause Sync
                </button>
                <button 
                  onClick={handleDownloadDoc}
                  disabled={state.isProcessing}
                  className="flex items-center gap-4 px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Download className="w-5 h-5" />
                  Export Legalized
                </button>
              </div>
            </div>

            {/* Document Side-by-Side View */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
              {showSource && (
                <div className="space-y-4">
                  <div className="px-6 py-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-t-2xl text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 border border-slate-200 dark:border-slate-800">
                    Draft / Original
                  </div>
                  <DocumentPreview chunks={state.chunks} mode="original" />
                </div>
              )}
              
              <div className={showSource ? "space-y-4" : "col-span-2 space-y-4"}>
                <div className="px-6 py-2 bg-indigo-600 rounded-t-2xl text-[10px] font-black uppercase tracking-[0.3em] text-white flex items-center justify-between shadow-lg">
                  <span>Authorized Translation</span>
                  <div className="flex items-center gap-2">
                    <Building className="w-3 h-3 fill-white" />
                    <span>Real Estate Mode</span>
                  </div>
                </div>
                <DocumentPreview chunks={state.chunks} mode="translated" />
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default App;
