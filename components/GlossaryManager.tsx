
import React, { useState } from 'react';
import { GlossaryItem } from '../types';
import { Plus, X, Book, Trash2 } from 'lucide-react';

interface GlossaryManagerProps {
  glossary: GlossaryItem[];
  onChange: (glossary: GlossaryItem[]) => void;
  onClose: () => void;
}

const GlossaryManager: React.FC<GlossaryManagerProps> = ({ glossary, onChange, onClose }) => {
  const [newOriginal, setNewOriginal] = useState('');
  const [newTarget, setNewTarget] = useState('');

  const addTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOriginal.trim() || !newTarget.trim()) return;

    const newItem: GlossaryItem = {
      id: Math.random().toString(36).substr(2, 9),
      original: newOriginal.trim(),
      target: newTarget.trim(),
    };

    onChange([...glossary, newItem]);
    setNewOriginal('');
    setNewTarget('');
  };

  const removeTerm = (id: string) => {
    onChange(glossary.filter(item => item.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Book className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold font-lexend">Custom Glossary</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <form onSubmit={addTerm} className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-3">
            <input
              type="text"
              placeholder="Original term"
              value={newOriginal}
              onChange={(e) => setNewOriginal(e.target.value)}
              className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <input
              type="text"
              placeholder="Translation"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl flex items-center justify-center transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Saved Mappings</h3>
            {glossary.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm italic">
                No custom terms added yet.
              </div>
            ) : (
              <div className="grid gap-2">
                {glossary.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{item.original}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{item.target}</span>
                    </div>
                    <button
                      onClick={() => removeTerm(item.id)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Finished
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlossaryManager;
