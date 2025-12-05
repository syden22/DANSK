
import React from 'react';
import LiveSession from './components/LiveSession';
import { ServerCrash } from 'lucide-react';

const App: React.FC = () => {
  let serverKey = '';
  
  // CRASH FIX: Use optional chaining (?.) to prevent error if import.meta.env is undefined
  try {
    // @ts-ignore
    serverKey = import.meta.env?.VITE_API_KEY || '';
  } catch (e) {
    // Silently fail if env is not accessible
  }

  // Strict Validation: Key must exist and start with 'AIza' (Google format)
  const isKeyValid = serverKey && typeof serverKey === 'string' && serverKey.startsWith('AIza');

  // Scenario A: Everything is configured correctly on Vercel
  if (isKeyValid) {
    return <LiveSession apiKey={serverKey} />;
  }

  // Scenario B: Key is missing on Vercel. 
  // We show a passive status screen instead of a crash.
  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-4 font-sans text-slate-400">
      <div className="flex flex-col items-center animate-pulse">
        <ServerCrash className="w-12 h-12 mb-4 text-slate-600" />
        <h1 className="text-xl font-medium text-slate-200">Требуется настройка сервера</h1>
        <p className="mt-2 text-sm text-center max-w-xs">
          Приложение ожидает переменную <code>VITE_API_KEY</code> в настройках Vercel.
          <br/><br/>
          <span className="text-xs opacity-50">Статус: Ключ не найден или неверен.</span>
        </p>
      </div>
    </div>
  );
};

export default App;
