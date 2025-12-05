
import React from 'react';
import LiveSession from './components/LiveSession';
import { ServerCrash, Lock } from 'lucide-react';

const App: React.FC = () => {
  let serverKey = '';
  
  // Safely attempt to read VITE_API_KEY
  try {
    // @ts-ignore
    serverKey = import.meta.env?.VITE_API_KEY || '';
  } catch (e) {
    console.warn("Env var access failed", e);
  }

  // Strict Validation: Key must exist and start with 'AIza'
  const isKeyValid = serverKey && typeof serverKey === 'string' && serverKey.startsWith('AIza');

  // Scenario A: Everything is configured correctly on Vercel
  if (isKeyValid) {
    return <LiveSession apiKey={serverKey} />;
  }

  // Scenario B: Key is missing on Vercel.
  // Display a clear, informative screen instead of crashing.
  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-6 font-sans text-slate-400">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col items-center text-center shadow-2xl">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6">
           <ServerCrash className="w-8 h-8 text-red-500" />
        </div>
        
        <h1 className="text-xl font-bold text-white mb-2">Настройка сервера не завершена</h1>
        
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Приложение запущено, но не может найти API ключ Google Gemini в настройках Vercel.
        </p>

        <div className="w-full bg-black/50 rounded-lg p-4 text-left space-y-3 mb-6 border border-slate-800">
           <div className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-yellow-500 mt-1 shrink-0" />
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Ожидаемая переменная</p>
                <code className="text-sm text-green-400 font-mono">VITE_API_KEY</code>
              </div>
           </div>
           <div className="h-px bg-slate-800 w-full" />
           <div>
             <p className="text-xs text-slate-500 uppercase font-bold mb-1">Текущий статус</p>
             <p className="text-sm text-red-400 font-mono">
               {serverKey ? 'Неверный формат (должен начинаться с AIza)' : 'Не найден (undefined)'}
             </p>
           </div>
        </div>

        <div className="text-xs text-slate-500">
          Совет: Перейдите в Vercel &rarr; Settings &rarr; Environment Variables, добавьте ключ и нажмите <b>Redeploy</b>.
        </div>
      </div>
    </div>
  );
};

export default App;
