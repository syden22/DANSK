import React, { useEffect, useState } from 'react';
import LiveSession from './components/LiveSession';
import { Key, Loader2, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    checkKey();
  }, []);

  const checkKey = async () => {
    try {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        // Assume success and update state to trigger re-render with LiveSession
        // The API key is injected into process.env.API_KEY automatically
        setHasKey(true);
      } catch (e) {
        console.error("Key selection failed", e);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-green-500 animate-spin" />
        <p className="text-white/50 text-sm">Проверка доступа...</p>
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl animate-fade-in-up">
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transform rotate-3">
              <Key className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Вход в систему</h1>
            <p className="text-slate-400 text-sm">
              Для работы приложения необходимо выбрать API ключ.
            </p>
          </div>

          <button 
            onClick={handleSelectKey}
            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-900/20"
          >
            Выбрать API ключ
          </button>

          <div className="mt-8 pt-6 border-t border-slate-700 text-center">
             <div className="flex items-start gap-3 text-left">
                <ShieldCheck className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  <strong>Безопасно:</strong> Ключ используется только в этом сеансе.
                  <br />
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-white">Информация о биллинге</a>
                </p>
             </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <LiveSession />
  );
};

export default App;