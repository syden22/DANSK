import React, { useState, useEffect } from 'react';
import LiveSession from './components/LiveSession';
import { ShieldAlert, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Строгая проверка конфигурации сервера
    const checkServerConfig = () => {
      try {
        // @ts-ignore
        const envKey = import.meta?.env?.VITE_API_KEY;

        if (envKey && typeof envKey === 'string' && envKey.startsWith('AIza')) {
          setApiKey(envKey);
        } else {
          console.error("VITE_API_KEY missing or invalid");
          setError("Ключ API не найден в настройках Vercel.");
        }
      } catch (e: any) {
        console.error("Env Access Error:", e);
        setError("Ошибка доступа к переменным окружения.");
      }
    };

    checkServerConfig();
  }, []);

  // СЦЕНАРИЙ 1: Все отлично, ключ есть -> Урок
  if (apiKey) {
    return (
      <LiveSession 
        apiKey={apiKey} 
        onLogout={() => {}} // Logout отключен, так как ключ на сервере
      />
    );
  }

  // СЦЕНАРИЙ 2: Ошибка конфигурации (Ключа нет)
  if (error) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 font-sans text-slate-200 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
           <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Требуется настройка сервера</h1>
        <p className="text-slate-400 mb-8 max-w-md">
          Приложение запущено, но не видит API ключа.
          <br/><br/>
          Зайдите в <b>Vercel &rarr; Settings &rarr; Environment Variables</b> и добавьте:
        </p>
        
        <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-left border border-slate-800 mb-8">
          <div className="text-slate-500 mb-1">Key:</div>
          <div className="text-green-400 mb-3">VITE_API_KEY</div>
          <div className="text-slate-500 mb-1">Value:</div>
          <div className="text-blue-400">AIza... (Ваш Google Key)</div>
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors font-bold"
        >
          <RefreshCw size={18} />
          <span>Я добавил, обновить</span>
        </button>
      </div>
    );
  }

  // СЦЕНАРИЙ 3: Инициализация (Мгновенно, заглушка)
  return null;
};

export default App;