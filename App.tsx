
import React, { useEffect, useState } from 'react';
import LiveSession from './components/LiveSession';
import { Key, Loader2, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  useEffect(() => {
    async function checkKey() {
      // 1. Check for Vite Environment Variable (Standard for Vercel/Vite deployments)
      // We use 'as any' to bypass TS checks if import.meta isn't fully typed in the setup
      const viteKey = (import.meta as any).env?.VITE_API_KEY;
      if (viteKey) {
        setApiKey(viteKey);
        setIsChecking(false);
        return;
      }

      // 2. Check for process.env (Legacy/AI Studio injection)
      if (process.env.API_KEY) {
        setApiKey(process.env.API_KEY);
        setIsChecking(false);
        return;
      }

      // 3. Check AI Studio interactive selection (Development mode)
      if (window.aistudio) {
        try {
          const hasSelected = await window.aistudio.hasSelectedApiKey();
          if (hasSelected) {
             // In AI Studio, the key is injected globally, we just signal we are ready
             // We'll pass a placeholder or let LiveSession assume process.env is now populated
             // ideally we'd get the key value, but for security AI Studio keeps it hidden in env.
             // We will assume process.env.API_KEY works after selection.
             setApiKey(process.env.API_KEY || "INJECTED_BY_AISTUDIO");
          }
        } catch (e) {
          console.error("Error checking AI Studio key state:", e);
        }
      }
      
      setIsChecking(false);
    }

    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        const selected = await window.aistudio.hasSelectedApiKey();
        if (selected) {
           // Force a reload or update state to grab the injected key
           setApiKey(process.env.API_KEY || "INJECTED_BY_AISTUDIO");
        }
      } catch (e) {
        console.error("Key selection failed or cancelled", e);
      }
    } else {
        alert("В этой версии приложения ключ нужно указать в файле .env или настройках Vercel как VITE_API_KEY");
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl text-center">
          <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-10 h-10 text-red-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-3">Требуется доступ</h1>
          <p className="text-slate-400 mb-8">
            Для работы репетитора необходим API ключ.
          </p>

          {window.aistudio ? (
            <button 
              onClick={handleSelectKey}
              className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 group"
            >
              <ShieldCheck className="w-5 h-5 group-hover:text-green-600 transition-colors" />
              Подключить Google Аккаунт
            </button>
          ) : (
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-600 text-left text-sm text-slate-300">
               <p className="font-bold text-white mb-2">Как запустить:</p>
               <ol className="list-decimal list-inside space-y-2">
                 <li>Создайте файл <code>.env</code></li>
                 <li>Добавьте: <code>VITE_API_KEY=ваш_ключ</code></li>
                 <li>Или добавьте эту переменную в настройках Vercel</li>
               </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <LiveSession apiKey={apiKey} />
  );
};

export default App;
