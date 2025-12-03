
import React, { useEffect, useState } from 'react';
import LiveSession from './components/LiveSession';
import { Key, Loader2, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  useEffect(() => {
    async function checkKey() {
      // 1. Check if process.env.API_KEY is already available (e.g. injected or local)
      if (process.env.API_KEY) {
        setHasKey(true);
        setIsChecking(false);
        return;
      }

      // 2. Check if we are in AI Studio environment and need to select a key
      if (window.aistudio) {
        try {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasKey(selected);
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
        // Assume success if no error thrown, prompt suggests relying on this flow
        // We force a re-render or state update to proceed. 
        // In AI Studio, the environment might reload or we can just proceed.
        const selected = await window.aistudio.hasSelectedApiKey();
        if (selected) {
           setHasKey(true);
        }
      } catch (e) {
        console.error("Key selection failed or cancelled", e);
      }
    } else {
        alert("Функция выбора ключа недоступна в этом браузере.");
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl text-center">
          <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-10 h-10 text-red-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-3">Требуется доступ</h1>
          <p className="text-slate-400 mb-8">
            Для работы репетитора необходимо подключить ваш Google Gemini API ключ.
          </p>

          <button 
            onClick={handleSelectKey}
            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 group"
          >
            <ShieldCheck className="w-5 h-5 group-hover:text-green-600 transition-colors" />
            Выбрать API Ключ
          </button>
          
          <div className="mt-6 text-xs text-slate-500">
             Используйте ключ от проекта с подключенным биллингом для доступа к Live API.
          </div>
        </div>
      </div>
    );
  }

  // Pass the key. Even if process.env.API_KEY was undefined initially, 
  // in AI Studio it is injected after selection.
  // We use the non-null assertion because we guarded with `hasKey` check which implies environment is ready.
  return (
    <LiveSession apiKey={process.env.API_KEY!} />
  );
};

export default App;
