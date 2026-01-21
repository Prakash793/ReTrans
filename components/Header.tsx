
import React from 'react';
import { Sun, Moon, Globe, Languages } from 'lucide-react';

interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme }) => {
  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 px-6 py-4 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* ReTrans Premium Branding */}
        <div className="flex items-center gap-5 group cursor-pointer select-none">
          <div className="relative">
            <div className="bg-gradient-to-tr from-blue-700 via-blue-500 to-cyan-400 p-3 rounded-2xl shadow-[0_8px_30px_rgba(37,99,235,0.4)] relative overflow-hidden group-hover:scale-110 transition-transform duration-500">
              <Globe className="w-9 h-9 text-white relative z-10 drop-shadow-md" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent opacity-60"></div>
              <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/10 rotate-45 transform translate-x-1/2 translate-y-1/2 animate-pulse"></div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-1.5 border-2 border-white dark:border-slate-900 shadow-xl z-20">
              <Languages className="w-4 h-4 text-white" />
            </div>
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="font-serif text-4xl font-black tracking-tighter text-[#003399] dark:text-blue-400 leading-none">
                Re<span className="relative">Trans<span className="absolute -bottom-1 left-0 w-full h-1 bg-yellow-400 rounded-full transform -skew-x-12 shadow-sm"></span></span>
              </span>
            </div>
            <div className="h-[2px] w-full bg-slate-900 dark:bg-slate-100 mt-1 opacity-20"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-800 dark:text-slate-100 py-1">
              Expert Translations
            </span>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Enterprise API</a>
          <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Global Security</a>
          <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Neural Logic</a>
        </nav>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5 text-slate-700" /> : <Sun className="w-5 h-5 text-yellow-400" />}
          </button>
          <button className="hidden sm:block px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-blue-600 text-white shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all">
            Secure Portal
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
