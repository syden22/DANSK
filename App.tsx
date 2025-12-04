import React, { useState, useEffect } from 'react';
import LiveSession from './components/LiveSession';
import { Key, ArrowRight, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Try to get key from Vercel Env (if configured)
    const envKey = process.env.VITE_API_KEY || process.env.API_KEY;
    
    // 2. Try to get key from Browser Storage
    const localKey = localStorage.getItem('gemini_api_key');

    if (envKey && envKey.startsWith('AIza')) {
      setApiKey(envKey);
    } else if (localKey && localKey.startsWith('AIza')) {
      setApiKey(localKey);
    }
    
    setIsLoading(false);
  }, []);

  const handleSaveKey = () => {
    if (inputValue.trim().startsWith('AIza')) {
      localStorage.setItem('gemini_api_key', inputValue.trim());
      setApiKey(inputValue.trim());
    } else {
      alert('Ключ должен начинаться с "AIza". Проверьте правильность.');
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey(null);
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  // If we have a valid key, run the App
  if (apiKey) {
    return <LiveSession apiKey={apiKey} onLogout={handleClearKey} />;
  }

  // Otherwise, show the Key Input Screen (Fixes Black Screen)
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 font-sans text-white">
      <div className="max-w-md w-full space-y-8 animate-fade-in-up">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Lær Dansk</h1>
          <p className="text-slate-400">Вход в систему обучения</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-8 rounded-3xl shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-600/20 rounded-full">
              <Key className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Google Gemini API Key
              </label>
              <input
                type="password"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            
            <button
              onClick={handleSaveKey}
              disabled={!inputValue}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 group"
            >
              Войти
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Ключ сохраняется только в вашем браузере.<br/>
            Мы не передаем его третьим лицам.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;