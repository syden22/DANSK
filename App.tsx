import React, { useState, useEffect } from 'react';
import LiveSession from './components/LiveSession';
import { Key, ArrowRight, Loader2, Globe } from 'lucide-react';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [manualKey, setManualKey] = useState('');

  useEffect(() => {
    const init = () => {
      // 1. Try Server Env Var (Priority for Vercel/Production)
      try {
        // @ts-ignore
        const envKey = import.meta.env?.VITE_API_KEY;
        if (envKey && typeof envKey === 'string' && envKey.startsWith('AIza')) {
          console.log("Using Server Key");
          setApiKey(envKey);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.warn("Env check failed, falling back to manual");
      }

      // 2. Try Local Storage (Convenience for Dev/Preview)
      const stored = localStorage.getItem('user_gemini_key');
      if (stored && stored.startsWith('AIza')) {
        console.log("Using Stored Key");
        setApiKey(stored);
      }
      
      setIsLoading(false);
    };

    init();
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualKey.trim().startsWith('AIza')) {
      localStorage.setItem('user_gemini_key', manualKey.trim());
      setApiKey(manualKey.trim());
    } else {
      alert('Ключ должен начинаться с "AIza"');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_gemini_key');
    setApiKey('');
    // Reload to re-check environment (in case it was updated) or clear state cleanly
    window.location.reload(); 
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-slate-500 animate-spin" />
      </div>
    );
  }

  // --- LOGGED IN (APP) ---
  if (apiKey) {
    return <LiveSession apiKey={apiKey} onLogout={handleLogout} />;
  }

  // --- LOGGED OUT (LOGIN SCREEN) ---
  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 font-sans text-slate-200">
      
      <div className="w-full max-w-md space-y-8 animate-fade-in-up">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-tr from-green-500 to-emerald-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-green-900/50">
            <Globe className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">DanishPro Tutor</h1>
          <p className="text-slate-400 text-lg">
            Ваш персональный ИИ-репетитор датского языка.
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">
                API Key (Gemini)
              </label>
              <div className="relative group">
                <Key className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-green-500 transition-colors" size={18} />
                <input 
                  type="password"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  placeholder="Вставьте AIza..."
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none transition-all placeholder:text-slate-700"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={!manualKey}
              className="w-full bg-white hover:bg-slate-200 text-slate-900 font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Войти</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/50 text-center">
             <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-green-400 transition-colors flex items-center justify-center gap-1">
               <span>Нет ключа? Получить бесплатно</span>
             </a>
          </div>
        </div>

        <div className="text-center">
           <p className="text-[10px] text-slate-600 font-mono">
             Server Status: {
               // @ts-ignore
               import.meta.env?.VITE_API_KEY ? 'CONFIGURED' : 'MANUAL MODE'
             }
           </p>
        </div>
      </div>
    </div>
  );
};

export default App;