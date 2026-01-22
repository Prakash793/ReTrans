
import React, { useState, useEffect } from 'react';
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
  AlertCircle, 
  ChevronDown,
  Eye,
  EyeOff,
  CheckCircle2,
  Key,
  ExternalLink,
  ShieldCheck,
  ScanText,
  AlertTriangle
} from 'lucide-react';

declare global {
  var aistudio: {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  };
}

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showGlossary, setShowGlossary] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [rawText, setRawText] = useState('');
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
      if (process.env.API_KEY && process.env.API_KEY !== 'undefined' && process.env.API_KEY.length > 10) {
        setHasKey(true);
        return;
      }
      try {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } catch (e) {
        setHasKey(false);
      }
    };
    initKeyCheck();
  }, []);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleSource = () => setShowSource(prev => !prev);

  const handleKeySelection = async () => {
    try {
      await window.aistudio.openSelectKey();
      // Assume selection success as per SDK rules
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
      statusMessage: 'Scanning Structural Fidelity...',
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
        statusMessage: processed.chunks.length > 0 ? 'Document Mapped.' : 'Vision Engine Ready.',
        isProcessing: false,
        originalFileType: file.name.split('.').pop() || 'pdf'
      }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: `Structure Scan Error: ${err.message}`, 
        statusMessage: 'Fail.' 
      }));
    }
  };

  const startTranslation = async () => {
    const currentKey = process.env.API_KEY;

    // DIAGNOSTIC: Detect OpenAI keys which cause the "Entity Not Found" error
    if (currentKey && currentKey.startsWith('sk-')) {
      setState(prev => ({ 
        ...prev, 
        error: "Incorrect Key Provider detected. You are using an OpenAI key (sk-...), but ReTrans requires a Google Gemini API Key (AIza...). Please select a Gemini key from your Google Cloud project."
      }));
      setHasKey(false);
      return;
    }

    if (!currentKey || currentKey === 'undefined' || currentKey.length < 5) {
      await handleKeySelection();
      // Proceeding immediately as per system instructions
    }

    const isImageBased = (state.chunks.length === 0 || state.chunks.every(c => !c.originalText.trim())) && state.originalFileData;
    
    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      error: null, 
      progress: 40, 
      statusMessage: isImageBased ? 'Fidelity Vision Scan...' : 'Neural Context Alignment...' 
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
          statusMessage: 'Fidelity Translation Ready.'
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
          statusMessage: 'Contextual Translation Ready.'
        }));
      }
    } catch (err: any) {
      const errorMsg = err.message || "";
      const isEntityNotFoundError = errorMsg.includes("Requested entity was not found");
      const isAuthError = errorMsg.includes("API key") || errorMsg.includes("An API Key must be set");

      if (isEntityNotFoundError || isAuthError) {
        setHasKey(false);
        // Do not immediately reopen to avoid infinite loops, but prompt user clearly
      }

      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: isEntityNotFoundError 
          ? 'Google Gemini Engine Error: The model "gemini-3" is not enabled or available for your project. Ensure your key is a GOOGLE GEMINI key (starting with AIza) and that the project is in a supported region.'
          : (isAuthError ? 'Active Google Gemini API Key Required. OpenAI keys (sk-...) are not supported.' : errorMsg), 
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

    const htmlHeader = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #1a202c; padding: 40px; }
          h1, h2, h3, h4, h5, h6 { font-size: 14pt; font-weight: bold; margin-bottom: 12pt; color: #000; }
          p { margin-bottom: 11pt; text-align: justify; font-size: 11pt; }
          table { border-collapse: collapse; width: 100%; margin: 15pt 0; border: 1.5pt solid #cbd5e0; }
          td, th { border: 1pt solid #cbd5e0; padding: 10pt; font-size: 10pt; vertical-align: top; }
          .bold { font-weight: bold; }
          .italic { font-style: italic; }
          .underline { text-decoration: underline; text-underline-offset: 2pt; }
          .checkbox { font-family: 'Segoe UI Symbol', sans-serif; margin-right: 8pt; font-size: 14pt; }
          .empty-line { height: 18pt; width: 100%; }
        </style>
      </head>
      <body>
    `;

    let bodyContent = "";
    let inTable = false;

    state.chunks.forEach((chunk) => {
      const text = mode === 'translated' ? (chunk.translatedText || chunk.originalText) : chunk.originalText;
      const weightClass = chunk.metadata?.isBold || chunk.type === 'heading' ? "bold" : "";
      const italicClass = chunk.metadata?.isItalic ? "italic" : "";
      const underlineClass = chunk.metadata?.isUnderlined ? "underline" : "";
      const align = chunk.metadata?.alignment || "left";

      if (chunk.type === 'empty-line') {
        if (inTable) { bodyContent += `</tr></table>`; inTable = false; }
        bodyContent += `<div class="empty-line"></div>`;
        return;
      }

      if (chunk.type === 'table-cell') {
        if (!inTable) { bodyContent += `<table><tr>`; inTable = true; }
        bodyContent += `<td style="text-align:${align}" class="${weightClass} ${italicClass} ${underlineClass}">${text}</td>`;
      } else {
        if (inTable) { bodyContent += `</tr></table>`; inTable = false; }

        if (chunk.type === 'heading') {
          const level = chunk.metadata?.level || 1;
          bodyContent += `<h${level} style="text-align:${align}" class="bold ${underlineClass}">${text}</h${level}>`;
        } else if (chunk.type === 'checkbox') {
          const box = chunk.metadata?.isChecked ? "☑" : "☐";
          bodyContent += `<p style="text-align:${align}" class="${weightClass} ${italicClass} ${underlineClass}"><span class="checkbox">${box}</span>${text}</p>`;
        } else {
          bodyContent += `<p style="text-align:${align}" class="${weightClass} ${italicClass} ${underlineClass}">${text}</p>`;
        }
      }
    });

    if (inTable) bodyContent += `</tr></table>`;

    const htmlFooter = `</body></html>`;
    const fullHtml = htmlHeader + bodyContent + htmlFooter;
    
    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const baseName = state.originalFileName ? state.originalFileName.replace(/\.[^/.]+$/, "") : "Document";
    const suffix = mode === 'original' ? '_ORIGINAL' : '_TRANSLATED';
    
    link.download = `ReTrans_${baseName}${suffix}.doc`;
    link.click();
    URL.revokeObjectURL(url);
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
    setShowSource(true);
  };

  return (
    <div className={`min-h-screen transition-all duration-500 ${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <Header theme={theme} toggleTheme={toggleTheme} />
      <main className="max-w-[1600px] mx-auto px-6 lg:px-12 py-12">
        {!state.originalFileName ? (
          <section className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-10 max-w-5xl mx-auto">
              <div className="flex justify-center mb-6">
                <span className="px-6 py-2 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-sm">
                  Neural Fidelity Mirror
                </span>
              </div>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none font-serif text-[#001a33] dark:text-white">
                Contextual.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-500 to-indigo-600">Enterprise Ready.</span>
              </h1>
              <p className="text-xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed">
                Translate complex enterprise files while maintaining perfect structural layout and semantic depth.
              </p>
            </div>
            <div className="max-w-4xl mx-auto">
              {!hasKey && (
                <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-4 text-amber-800 dark:text-amber-400">
                    <AlertTriangle className="w-8 h-8 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-sm">Action Required: Key Type Conflict</p>
                      <p className="text-xs opacity-90">OpenAI keys (sk-...) will fail. Connect a **Google Gemini Key** (AIza...) to start.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener" className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 hover:underline">
                      Get Gemini Key <ExternalLink className="w-3 h-3" />
                    </a>
                    <button onClick={handleKeySelection} className="bg-amber-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-600/20">
                      Link Gemini
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-center mb-10">
                <div className="bg-white/80 dark:bg-slate-900/80 p-1.5 rounded-2xl flex gap-1 border border-slate-200 dark:border-slate-800 shadow-xl">
                  <button onClick={() => setInputMode('file')} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${inputMode === 'file' ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-400'}`}>
                    <FileText className="w-3.5 h-3.5" /> Document Upload
                  </button>
                  <button onClick={() => setInputMode('text')} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${inputMode === 'text' ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-400'}`}>
                    <Type className="w-3.5 h-3.5" /> Manual Entry
                  </button>
                </div>
              </div>
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-2xl p-6 min-h-[400px]">
                {inputMode === 'file' ? <FileUploader onUpload={handleFileUpload} /> : (
                  <div className="h-full flex flex-col gap-6">
                    <textarea className="flex-1 bg-transparent border-none focus:ring-0 text-xl font-medium placeholder:text-slate-300 resize-none min-h-[300px]" placeholder="Paste document content..." value={rawText} onChange={(e) => setRawText(e.target.value)} />
                    <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => setState(p => ({...p, originalFileName: 'Draft', chunks: rawText.split('\n').map((l,i)=>({id:`t-${i}`,type:l.trim()?'paragraph':'empty-line',originalText:l}))}))} className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3">Process Content <ArrowRight className="w-5 h-5" /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="flex flex-col xl:flex-row items-center justify-between gap-8">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="bg-white dark:bg-slate-800 p-3 px-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-[160px]"><label className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-600 block mb-0.5">Source</label><LanguagePicker value={state.sourceLang} onChange={(v) => setState(p => ({ ...p, sourceLang: v }))} /></div>
                  <div className="text-slate-400"><ArrowRight className="w-4 h-4" /></div>
                  <div className="bg-white dark:bg-slate-800 p-3 px-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-[160px]"><label className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-600 block mb-0.5">Target</label><LanguagePicker value={state.targetLang} onChange={(v) => setState(p => ({ ...p, targetLang: v }))} /></div>
                  <div className="bg-white dark:bg-slate-800 p-3 px-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-[160px] relative">
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-600 block mb-0.5">Context Tone</label>
                    <select value={state.tone} onChange={(e) => setState(p => ({ ...p, tone: e.target.value as TranslationTone }))} className="bg-transparent border-none p-0 focus:ring-0 font-bold text-slate-700 dark:text-white cursor-pointer w-full appearance-none">
                      {TRANSLATION_TONES.map(t => (<option key={t.id} value={t.id}>{t.icon} {t.name}</option>))}
                    </select><ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-4 top-1/2" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <button onClick={toggleSource} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all border ${showSource ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {showSource ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showSource ? 'Pure Translation' : 'Comparative View'}
                  </button>
                  <button onClick={() => setShowGlossary(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"><Book className="w-4 h-4" /> Glossary</button>
                  <button onClick={startTranslation} disabled={state.isProcessing} className="bg-blue-600 text-white px-10 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center gap-3 hover:bg-blue-700 transition-all">
                    {state.isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
                    {state.isProcessing ? 'Translating...' : 'Start Translation'}
                  </button>
                  <button onClick={reset} className="text-slate-400 hover:text-red-500 font-black text-[10px] uppercase tracking-[0.2em] ml-2">Reset</button>
                </div>
              </div>
              {state.statusMessage && (
                <div className="mt-4 flex items-center justify-center gap-2 text-blue-600 font-black text-[9px] uppercase tracking-[0.3em]">
                  {state.progress === 100 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />} {state.statusMessage}
                </div>
              )}
            </div>
            
            <div className={`grid gap-8 min-h-[75vh] transition-all duration-500 ${showSource ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-4xl mx-auto'}`}>
              {showSource && (
                <div className="flex flex-col bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden animate-in slide-in-from-left-4 duration-500">
                  <div className="px-8 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400">Source Capture</h3>
                    {state.chunks.length > 0 && (
                      <button 
                        onClick={() => handleDownloadDoc('original')} 
                        className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-1.5 rounded-lg text-[9px] font-black tracking-widest flex items-center gap-2 hover:bg-slate-300 transition-colors"
                      >
                        <ScanText className="w-3.5 h-3.5" /> SAVE ORIGINAL
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 md:p-10">
                    <DocumentPreview chunks={state.chunks} mode="original" />
                  </div>
                </div>
              )}
              <div className="flex flex-col bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative transition-all duration-500">
                <div className="px-8 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-blue-50/10">
                  <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-blue-600">Enterprise Fidelity</h3>
                  {state.progress === 100 && (
                    <button onClick={() => handleDownloadDoc('translated')} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-[9px] font-black tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-colors">
                      <Download className="w-3.5 h-3.5" /> EXPORT PROFESSIONAL
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-10">
                  {state.error ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-4">
                      <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-full">
                        <AlertCircle className="w-12 h-12 text-red-500" />
                      </div>
                      <h4 className="text-xl font-bold">Engine Conflict Detected</h4>
                      <p className="text-slate-500 text-sm max-w-lg mx-auto leading-relaxed">{state.error}</p>
                      
                      <div className="flex flex-col gap-4 items-center mt-6">
                        <div className="flex gap-4">
                          <button onClick={startTranslation} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-slate-800">
                            Retry Mirror
                          </button>
                          <button onClick={handleKeySelection} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-blue-700">
                            <Key className="w-4 h-4" /> Link Google Key
                          </button>
                        </div>
                        <p className="text-[9px] uppercase tracking-widest text-slate-400 font-black">
                          Note: You MUST use a Gemini API key starting with "AIza..."
                        </p>
                      </div>
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
