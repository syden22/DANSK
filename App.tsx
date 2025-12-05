
import React, { useState, useEffect } from 'react';
import LiveSession from './components/LiveSession';
import { Key, LogIn, RefreshCcw } from 'lucide-react';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    // 1. Try to get key from Server Environment (Vercel) safely
    let serverKey = '';
    try {
      // @ts-ignore
      if (import.meta.env.VITE_API_KEY) {
        // @ts-ignore
        serverKey = import.meta.env.VITE_API_KEY;
      }
    } catch (e) {
      // Ignore environment errors
    }

    // 2. Try to get key from Local Storage (Browser memory)
    const localKey = localStorage.getItem('gemini_api_key');

    // 3. Decide which key to use
    if (serverKey && serverKey.startsWith('AIza')) {
      setApiKey(serverKey);
    } else if (localKey && localKey.startsWith('AIza')) {
      setApiKey(localKey);
    }
  }, []);

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = inputValue.trim();
    if (cleanKey.startsWith('AIza')) {
      localStorage.setItem('gemini_api_key', cleanKey);
      setApiKey(cleanKey);
    } else {
      alert('Ошибка: Ключ должен начинаться с "AIza"');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setInputValue('');
    window.location.reload(); // Force reload to clear any stale states
  };

  // --- SCENARIO 1: KEY EXISTS -> SHOW APP ---
  if (apiKey) {
    return (
      <LiveSession 
        apiKey={apiKey} 
        onLogout={handleLogout} 
      />
    );
  }

  // --- SCENARIO 2: NO KEY -> SHOW LOGIN ---
  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center p-6 font-sans text-slate-200">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1492571350019-22de08371fd3?q=80&w=2000&auto=format&fit=crop" 
          className="w-full h-full object-cover opacity-30" 
          alt="Background"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
      </div>

      <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl flex flex-col items-center text-center shadow-2xl relative z-10">
        
        <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-green-900/50">
           <LogIn className="w-8 h-8 text-white" />
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2">DanishPro</h1>
        <p className="text-slate-400 mb-8">Симулятор языковой среды</p>
        
        <form onSubmit={handleManualLogin} className="w-full space-y-4">
          <input 
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Вставьте API ключ (AIza...)"
            className="w-full bg-black/50 border border-slate-600 text-white px-5 py-4 rounded-xl focus:outline-none focus:border-green-500 transition-all placeholder:text-slate-500 text-center text-lg"
          />

          <button 
            type="submit"
            disabled={!inputValue}
            className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 text-lg"
          >
            Войти в систему
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">
          Ключ сохраняется только в вашем браузере.
        </p>
      </div>
    </div>
  );
};

export default App;
