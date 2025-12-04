
import React, { useEffect, useState } from 'react';
import LiveSession from './components/LiveSession';
import { Key, Loader2, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  useEffect(() => {
    async function checkKey() {
      // 1. Check for Vite Environment Variable (Standard for Vercel/Vite deployments)
      // This is the SECURE way to handle keys in frontend apps (configured in Vercel Settings)
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

      // 3. Check AI Studio interactive selection (Development mode only)
      if (window.aistudio) {
        try {
          const hasSelected = await window.aistudio.hasSelectedApiKey();
          if (hasSelected) {
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
           setApiKey(process.env.API_KEY || "INJECTED_BY_AISTUDIO");
        }
      } catch (e) {
        console.error("Key selection failed or cancelled", e);
      }
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
      </div>
    );
  }

  // VALIDATION: Check if user accidentally used an OpenAI key
  if (apiKey && apiKey.startsWith('sk-')) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-red-500/50 shadow-2xl text-center">
          <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Неверный тип ключа</h1>
          <div className="text-slate-300 mb-6 text-sm bg-slate-900 p-4 rounded-xl text-left space-y-2">
            <p>Вы используете ключ <strong>OpenAI</strong> (начинается на <code className="text-red-400">sk-</code>).</p>
            <p className="border-t border-slate-700 pt-2">Эта программа работает на технологиях <strong>Google</strong> и требует ключ Google Gemini.</p>
            <p>Он должен начинаться на <code className="text-green-400">AIza...</code></p>
          </div>
          <button 
             onClick={() => { setApiKey(null); }}
             className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all"
          >
             Сбросить ключ
          </button>
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl text-center animate-fade-in-up">
          <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-10 h-10 text-red-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-3">Требуется доступ</h1>
          <p className="text-slate-400 mb-8">
            Сервер обновляется. Если вы добавили ключ в Vercel, подождите минуту и нажмите кнопку ниже.
          </p>

          <button 
             onClick={() => window.location.reload()}
             className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mb-4"
          >
             <RefreshCw className="w-5 h-5" />
             Обновить страницу
          </button>

          {window.aistudio ? (
            <button 
              onClick={handleSelectKey}
              className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 group"
            >
              <ShieldCheck className="w-5 h-5 group-hover:text-green-600 transition-colors" />
              Подключить Google Аккаунт
            </button>
          ) : (
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-600 text-left text-sm text-slate-300 opacity-60">
               <p className="font-bold text-white mb-2 text-xs uppercase tracking-wider">Статус Vercel</p>
               <p className="text-xs">Ожидание ключа VITE_API_KEY...</p>
               <p className="text-[10px] text-slate-500 mt-2 text-right">v1.1.0 Auto-Deploy</p>
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
