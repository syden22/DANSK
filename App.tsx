
import React, { useState, useEffect } from 'react';
import LiveSession from './components/LiveSession';
import { Key, Server, LogIn, ShieldAlert } from 'lucide-react';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [inputKey, setInputKey] = useState('');
  const [authSource, setAuthSource] = useState<'server' | 'local' | null>(null);

  useEffect(() => {
    // Check credentials on mount
    checkAuth();
  }, []);

  const checkAuth = () => {
    // 1. Try Server Env (Vercel) - Wrapped in try/catch to prevent crashes
    let serverKey = '';
    try {
      // Safe access to vite env
      // @ts-ignore
      if (import.meta && import.meta.env && import.meta.env.VITE_API_KEY) {
        // @ts-ignore
        serverKey = import.meta.env.VITE_API_KEY;
      }
    } catch (e) {
      console.warn("Server config check skipped:", e);
    }

    if (isValidKey(serverKey)) {
      setApiKey(serverKey);
      setAuthSource('server');
      return;
    }

    // 2. Try Local Storage (Browser Memory for Testing)
    const localKey = localStorage.getItem('gemini_api_key');
    if (isValidKey(localKey)) {
      setApiKey(localKey!);
      setAuthSource('local');
    }
  };

  const isValidKey = (key: string | null | undefined) => {
    return key && typeof key === 'string' && key.trim().startsWith('AIza');
  };

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidKey(inputKey)) {
      const cleanedKey = inputKey.trim();
      localStorage.setItem('gemini_api_key', cleanedKey);
      setApiKey(cleanedKey);
      setAuthSource('local');
    } else {
      alert('Ошибка: Ключ должен начинаться с "AIza"');
    }
  };

  const handleLogout = () => {
    if (authSource === 'local') {
      localStorage.removeItem('gemini_api_key');
    }
    setApiKey('');
    setAuthSource(null);
    setInputKey('');
  };

  // --- RENDER APP (If Key Exists) ---
  if (apiKey) {
    return (
      <LiveSession 
        apiKey={apiKey} 
        onLogout={authSource === 'local' ? handleLogout : undefined} 
      />
    );
  }

  // --- RENDER LOGIN SCREEN (Fallback / Test Mode) ---
  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center p-6 font-sans text-slate-200">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-black to-black z-0" />

      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl flex flex-col items-center text-center shadow-2xl relative z-10 animate-fade-in-up">
        
        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-slate-700">
           <LogIn className="w-8 h-8 text-white" />
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">DanishPro</h1>
        <p className="text-slate-400 text-sm mb-8">Вход в систему</p>
        
        <form onSubmit={handleManualLogin} className="w-full space-y-4">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <Key size={18} />
            </div>
            <input 
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Вставьте API ключ (AIza...)"
              className="w-full bg-black/50 border border-slate-700 text-white pl-12 pr-4 py-4 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all placeholder:text-slate-600"
            />
          </div>

          <button 
            type="submit"
            disabled={!inputKey}
            className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Войти
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 w-full">
           <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-2">
             <Server size={12} />
             <span>Статус сервера Vercel:</span>
           </div>
           
           <div className="text-xs text-slate-400 bg-slate-800 px-3 py-2 rounded-lg inline-flex items-center gap-2 border border-slate-700">
             <ShieldAlert size={12} className="text-yellow-500" />
             Конфигурация не найдена. Включен ручной вход.
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
