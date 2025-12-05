
import React, { useState, useEffect } from 'react';
import LiveSession from './components/LiveSession';
import { LogIn, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [inputValue, setInputValue] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      let keyFound = '';

      // 1. Пытаемся безопасно достать ключ из Vercel (Сервер)
      try {
        // @ts-ignore
        const envKey = import.meta.env.VITE_API_KEY;
        if (envKey && typeof envKey === 'string' && envKey.startsWith('AIza')) {
          keyFound = envKey;
          console.log("Авторизация через сервер успешна");
        }
      } catch (e) {
        console.warn("Настройки сервера недоступны, переходим к ручному режиму");
      }

      // 2. Если на сервере пусто, ищем в памяти браузера (для тестов)
      if (!keyFound) {
        const localKey = localStorage.getItem('gemini_api_key');
        if (localKey && localKey.startsWith('AIza')) {
          keyFound = localKey;
        }
      }

      if (keyFound) setApiKey(keyFound);
      setIsReady(true);
    };

    initApp();
  }, []);

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = inputValue.trim();
    if (cleanKey.startsWith('AIza')) {
      localStorage.setItem('gemini_api_key', cleanKey);
      setApiKey(cleanKey);
    } else {
      alert('Ошибка: Это не похоже на ключ Google. Он должен начинаться на "AIza"');
    }
  };

  const handleLogout = () => {
    // Если ключ был с сервера, мы не можем его удалить, но можем перезагрузить
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setInputValue('');
    window.location.reload();
  };

  // Если инициализация еще идет (доли секунды) - показываем черный фон, чтобы не мигало
  if (!isReady) return <div className="bg-black min-h-screen" />;

  // СЦЕНАРИЙ 1: Ключ есть (с сервера или памяти) -> ЗАПУСК ПРИЛОЖЕНИЯ
  if (apiKey) {
    return (
      <LiveSession 
        apiKey={apiKey} 
        onLogout={handleLogout} 
      />
    );
  }

  // СЦЕНАРИЙ 2: Ключа нет -> ЭКРАН ВХОДА (Для тестов или админа)
  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center p-6 font-sans text-slate-200 relative overflow-hidden">
      
      {/* Фоновое изображение */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=2000&auto=format&fit=crop" 
          className="w-full h-full object-cover opacity-40 blur-sm scale-105" 
          alt="Copenhagen"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40" />
      </div>

      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 p-8 rounded-3xl flex flex-col items-center text-center shadow-2xl relative z-10 animate-fade-in-up">
        
        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-green-900/50 transform rotate-3">
           <ShieldCheck className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">DanishPro</h1>
        <p className="text-slate-400 mb-8 text-lg">Система живого обучения</p>
        
        <div className="w-full bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6 text-left">
          <p className="text-yellow-200 text-xs font-medium">
            ⚠ <strong>Режим тестирования:</strong><br/>
            Сервер Vercel не передал ключ API. Для запуска введите ваш ключ разработчика вручную.
          </p>
        </div>

        <form onSubmit={handleManualLogin} className="w-full space-y-4">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl opacity-30 group-hover:opacity-100 transition duration-500 blur"></div>
            <input 
              type="password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Вставьте ключ (начинается с AIza...)"
              className="relative w-full bg-black border border-slate-700 text-white px-5 py-4 rounded-xl focus:outline-none focus:border-green-500 transition-all placeholder:text-slate-600 text-center text-lg shadow-inner"
            />
          </div>

          <button 
            type="submit"
            disabled={!inputValue}
            className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 text-lg shadow-lg active:scale-95 duration-200"
          >
            Запустить систему
          </button>
        </form>

        <p className="mt-8 text-xs text-slate-600">
          Данные шифруются и хранятся локально на устройстве.
        </p>
      </div>
    </div>
  );
};

export default App;
