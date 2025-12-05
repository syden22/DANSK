import React from 'react';
import LiveSession from './components/LiveSession';
import { ServerCrash } from 'lucide-react';

const App: React.FC = () => {
  // STRICT SERVER-ONLY MODE
  // We securely retrieve the key from Vercel Environment Variables.
  // Using optional chaining (?.) prevents crashes if import.meta.env is undefined.
  
  // @ts-ignore
  const env = import.meta.env;
  const serverKey = env?.VITE_API_KEY;

  // Check if key exists and looks valid (starts with AIza)
  const isValidKey = serverKey && typeof serverKey === 'string' && serverKey.startsWith('AIza');

  if (isValidKey) {
    return <LiveSession apiKey={serverKey} />;
  }

  // If we are here, the Server is not configured correctly.
  return (
    <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-4 font-sans text-white">
      <div className="max-w-lg w-full bg-slate-900 border border-red-900/50 rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ServerCrash className="w-10 h-10 text-red-500" />
          </div>
          
          <h1 className="text-2xl font-bold mb-4 text-red-400">Ошибка Настройки Сервера</h1>
          
          <p className="text-slate-300 mb-6 leading-relaxed">
            Приложение не видит ключ <b>VITE_API_KEY</b>.
          </p>

          <div className="bg-black/50 p-4 rounded-xl text-left font-mono text-sm text-slate-400 mb-6 border border-slate-800">
            <p className="mb-2 text-slate-500">// Debug Status:</p>
            <p>Key Present: <span className="text-red-500">False</span></p>
          </div>

          <div className="text-sm text-slate-500">
            1. Зайдите в Vercel &rarr; Settings &rarr; Environment Variables.<br/>
            2. Добавьте <b>VITE_API_KEY</b>.<br/>
            3. Сделайте <b>Redeploy</b>.
          </div>
      </div>
    </div>
  );
};

export default App;