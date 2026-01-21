
import React, { useState } from 'react';
import { TranslationState, DocumentChunk, TranslationTone } from './types';
import { fileService } from './services/fileService';
import { geminiService } from './services/geminiService';
import { TRANSLATION_TONES } from './constants';
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
  FileCheck, 
  AlertCircle, 
  ChevronDown,
  Eye
} from 'lucide-react';

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showGlossary, setShowGlossary] = useState(false);
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [rawText, setRawText] = useState('');
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

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleFileUpload = async (file: File) => {
    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      progress: 10, 
      statusMessage: 'Scanning Document Layer...',
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
        statusMessage: processed.chunks.length > 0 ? 'Structure Mapped.' : 'Image-based Document Detected.',
        isProcessing: false,
        originalFileType: file.name.split('.').pop() || 'pdf'
      }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: `Structural Scan Error: ${err.message}`, 
        statusMessage: 'Mapping Failed.' 
      }));
    }
  };

  const startTranslation = async () => {
    const isImageBased = state.chunks.length === 0 && state.originalFileData;
    
    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      error: null, 
      progress: 40, 
      statusMessage: isImageBased ? 'Initiating Vision Neural Scan...' : 'Analyzing Linguistic Context...' 
    }));
    
    try {
      if (isImageBased && state.originalFileData) {
        // MULTIMODAL FALLBACK
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
          statusMessage: 'Vision Optimized Translation.'
        }));
      } else {
        // STANDARD CHUNKED TRANSLATION
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
          statusMessage: 'Translation Optimized.'
        }));
      }
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: err.message || 'Unknown protocol interruption.', 
        progress: 0, 
        statusMessage: 'Linguistic Link Severed.' 
      }));
    }
  };

  const reset = () => {
    setState({
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
    setRawText('');
  };

  return (
    <div className={`min-h-screen transition-all duration-500 ${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <Header theme={theme} toggleTheme={toggleTheme} />
      <main className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16">
        {!state.originalFileName ? (
          <section className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-10 max-w-5xl mx-auto">
              <div className="flex justify-center mb-6">
                <span className="px-6 py-2 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-sm">
                  Precision Neural Engine
                </span>
              </div>
              <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-none font-serif text-[#001a33] dark:text-white">
                Global Context. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-500 to-indigo-600">Pure Accuracy.</span>
              </h1>
              <p className="text-2xl text-slate-500 dark:text-slate-400 max-w-4xl mx-auto font-medium leading-relaxed">
                Translate enterprise files with semantic abstract logic and multimodal OCR personas.
              </p>
            </div>
            <div className="max-w-5xl mx-auto">
              <div className="flex justify-center mb-10">
                <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-[2.5rem] flex gap-2 border border-slate-200 dark:border-slate-800 shadow-2xl">
                  <button onClick={() => setInputMode('file')} className={`flex items-center gap-3 px-10 py-4 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all ${inputMode === 'file' ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-400'}`}>
                    <FileText className="w-4 h-4" /> Secure File
                  </button>
                  <button onClick={() => setInputMode('text')} className={`flex items-center gap-3 px-10 py-4 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all ${inputMode === 'text' ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-400'}`}>
                    <Type className="w-4 h-4" /> Direct Input
                  </button>
                </div>
              </div>
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[3rem] shadow-2xl p-5 min-h-[480px]">
                {inputMode === 'file' ? <FileUploader onUpload={handleFileUpload} /> : (
                  <div className="p-10 h-full flex flex-col gap-8">
                    <textarea className="flex-1 bg-transparent border-none focus:ring-0 text-2xl font-medium placeholder:text-slate-300 resize-none min-h-[340px]" placeholder="Paste document text here..." value={rawText} onChange={(e) => setRawText(e.target.value)} />
                    <div className="flex justify-end pt-6 border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => setState(p => ({...p, originalFileName: 'Input_Buffer', chunks: rawText.split('\n').map((l,i)=>({id:`t-${i}`,type:'paragraph',originalText:l}))}))} className="bg-blue-600 text-white px-14 py-6 rounded-2xl font-black uppercase tracking-widest shadow-2xl flex items-center gap-4">Analyze Text <ArrowRight className="w-6 h-6" /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className="space-y-12 animate-in fade-in duration-1000">
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800/40 shadow-2xl">
              <div className="flex flex-col xl:flex-row items-center justify-between gap-10">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="bg-white dark:bg-slate-800 p-4 px-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm min-w-[200px]"><label className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 block mb-1">From</label><LanguagePicker value={state.sourceLang} onChange={(v) => setState(p => ({ ...p, sourceLang: v }))} /></div>
                  <div className="bg-blue-600 text-white p-3 rounded-full shadow-lg"><ArrowRight className="w-5 h-5" /></div>
                  <div className="bg-white dark:bg-slate-800 p-4 px-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm min-w-[200px]"><label className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 block mb-1">To</label><LanguagePicker value={state.targetLang} onChange={(v) => setState(p => ({ ...p, targetLang: v }))} /></div>
                  <div className="bg-white dark:bg-slate-800 p-4 px-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm min-w-[200px] relative">
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 block mb-1">Domain Accuracy</label>
                    <div className="flex items-center justify-between group cursor-pointer">
                      <select value={state.tone} onChange={(e) => setState(p => ({ ...p, tone: e.target.value as TranslationTone }))} className="bg-transparent border-none p-0 focus:ring-0 font-bold text-slate-700 dark:text-white cursor-pointer w-full appearance-none">
                        {TRANSLATION_TONES.map(t => (<option key={t.id} value={t.id}>{t.icon} {t.name}</option>))}
                      </select><ChevronDown className="w-4 h-4 text-slate-400 absolute right-6" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <button onClick={() => setShowGlossary(true)} className="flex items-center gap-3 px-8 py-4.5 rounded-2xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><Book className="w-4.5 h-4.5" /> Glossary</button>
                  <button onClick={startTranslation} disabled={state.isProcessing} className="bg-blue-600 text-white px-12 py-4.5 rounded-[1.8rem] font-black uppercase tracking-widest shadow-2xl flex items-center gap-4">
                    {state.isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Globe className="w-6 h-6" />}
                    {state.isProcessing ? 'Processing...' : 'Translate'}
                  </button>
                  <button onClick={reset} className="text-slate-400 hover:text-red-600 font-black text-[11px] uppercase tracking-[0.3em]">Reset</button>
                </div>
              </div>
              {state.statusMessage && (
                <div className="mt-6 flex items-center justify-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-[0.3em]">
                  <Loader2 className={`w-3 h-3 ${state.isProcessing ? 'animate-spin' : ''}`} /> {state.statusMessage}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[85vh]">
              <div className="flex flex-col bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                <div className="px-10 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-black text-[11px] uppercase tracking-[0.4em] text-slate-400">Source Document</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                  {state.chunks.length === 0 && state.originalFileData ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4 opacity-60">
                      <Eye className="w-16 h-16 text-blue-500" />
                      <p className="font-bold">Image-based PDF Detected</p>
                      <p className="text-sm">Standard text mapping failed. ReTrans will use Vision-OCR Fallback to read this document during translation.</p>
                    </div>
                  ) : (
                    <DocumentPreview chunks={state.chunks} mode="original" />
                  )}
                </div>
              </div>
              <div className="flex flex-col bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative">
                <div className="px-10 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-blue-50/20">
                  <h3 className="font-black text-[11px] uppercase tracking-[0.4em] text-blue-700">Neural Optimized Output</h3>
                  {state.progress === 100 && (
                    <button onClick={() => {}} className="bg-blue-600 text-white px-8 py-3 rounded-xl text-[10px] font-black tracking-widest flex items-center gap-3"><Download className="w-4 h-4" /> EXPORT</button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                  {state.error ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6">
                      <AlertCircle className="w-16 h-16 text-red-500" /><h4 className="text-2xl font-bold">Linguistic Breakpoint</h4><p className="text-slate-500 max-w-sm">{state.error}</p><button onClick={startTranslation} className="bg-slate-900 text-white px-10 py-4 rounded-xl font-bold">Retry Engine</button>
                    </div>
                  ) : (
                    <DocumentPreview chunks={state.chunks} mode="translated" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      {showGlossary && <GlossaryManager glossary={state.glossary} onChange={(g) => setState(p => ({ ...p, glossary: g }))} onClose={() => setShowGlossary(false)} />}
      <Footer />
    </div>
  );
};

export default App;
