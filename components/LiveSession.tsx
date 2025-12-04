
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Phone, PhoneOff, Settings, MessageSquare, X, Volume2, LogOut, Loader2, HelpCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createBlob, decode, decodeAudioData } from '../utils/audio';
import Visualizer from './Visualizer';
import { ChatMessage, ConnectionState, AudioConfig, VOICES } from '../types';

interface LiveSessionProps {
  // apiKey removed as it is now accessed via process.env.API_KEY
}

type EndReason = 'user' | 'error' | 'remote';

const LiveSession: React.FC<LiveSessionProps> = () => {
  // Application State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionStep, setConnectionStep] = useState<string>(''); // Detailed status text
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Audio/Session State
  const [micEnabled, setMicEnabled] = useState(true);
  const [transcripts, setTranscripts] = useState<ChatMessage[]>([]);
  const [config, setConfig] = useState<AudioConfig>({ voiceName: 'Kore', playbackRate: 1.0 });
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');

  // Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const playbackRateRef = useRef(1.0);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    playbackRateRef.current = config.playbackRate;
  }, [config.playbackRate]);

  // --- Resource Cleanup ---
  const disconnectResources = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }

    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current.clear();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (inputContextRef.current && inputContextRef.current.state !== 'closed') {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current && outputContextRef.current.state !== 'closed') {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }
    
    setIsUserSpeaking(false);
    setIsModelSpeaking(false);
  }, []);

  // --- User Actions ---
  
  const handleHangUp = useCallback((reason: EndReason = 'user', message?: string) => {
    disconnectResources();
    setConnectionState('disconnected');
    setEndReason(reason);
    if (message) setErrorMsg(message);
    setIsModelSpeaking(false);
    setCurrentSubtitle('');
  }, [disconnectResources]);

  const handleReset = useCallback(() => {
    disconnectResources();
    setConnectionState('disconnected');
    setEndReason(null);
    setErrorMsg(null);
    setTranscripts([]);
    setShowSettings(false);
    setShowChat(false);
    setShowHelp(false);
    setIsModelSpeaking(false);
    setCurrentSubtitle('');
  }, [disconnectResources]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnectResources();
  }, [disconnectResources]);

  // --- Connection Logic ---

  const connect = async () => {
    try {
      // Reset State
      handleReset();
      setConnectionState('connecting');
      setConnectionStep('Инициализация аудио...');
      
      // Safety Timeout (30s)
      connectTimeoutRef.current = setTimeout(() => {
        handleHangUp('error', "Время ожидания истекло. Сервер не отвечает.");
      }, 30000);

      // 1. Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      
      await inputCtx.resume();
      await outputCtx.resume();

      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // 2. Microphone Access
      setConnectionStep('Запрос доступа к микрофону...');
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        handleHangUp('error', "Нет доступа к микрофону. Разрешите его в браузере.");
        return;
      }
      streamRef.current = stream;

      // 3. API Connection
      setConnectionStep('Соединение с ИИ сервером...');
      // Initialize with process.env.API_KEY as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } },
          },
          // Empty objects required for transcription
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
          systemInstruction: `
            You are ${config.voiceName === 'Kore' ? 'Mette' : 'Mads'}, a friendly Danish tutor.

            RULES:
            1. **EMERGENCY STOP**: If user says "Стоп" (Stop), "Не понимаю" (I don't understand), "Переведи" (Translate) -> **IMMEDIATELY** switch to Russian and explain.
            
            2. **SENTENCE LIMIT**: Speak **MAXIMUM 1 SENTENCE** at a time. Do not make speeches. Wait for the user to respond.
            
            3. **LANGUAGE**: 
               - Default: Speak simple Danish.
               - If user struggles: Speak Russian.
               - Always match the user's language if they switch to Russian.

            4. **ROLE**: 
               - You are a helpful human tutor on a phone call. 
               - Correct mistakes gently. 
               - Keep the conversation flowing naturally.
          `,
        },
        callbacks: {
          onopen: () => {
            if (connectTimeoutRef.current) {
              clearTimeout(connectTimeoutRef.current);
              connectTimeoutRef.current = null;
            }
            setConnectionState('connected');
            setConnectionStep('Готово');
            
            // Setup Audio Processing Pipeline
            const source = inputCtx.createMediaStreamSource(stream);
            sourceRef.current = source;
            
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              if (!micEnabled) return;
              
              const inputData = e.inputBuffer.getChannelData(0);
              // Simple VAD (Voice Activity Detection) visualization
              const rms = Math.sqrt(inputData.reduce((acc, val) => acc + val * val, 0) / inputData.length);
              setIsUserSpeaking(rms > 0.01);

              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Text Transcripts
            if (msg.serverContent?.outputTranscription?.text) {
               const text = msg.serverContent.outputTranscription.text;
               updateTranscript('model', text, true);
               setCurrentSubtitle(text);
            }
            if (msg.serverContent?.inputTranscription?.text) {
               updateTranscript('user', msg.serverContent.inputTranscription.text, true);
            }
            if (msg.serverContent?.turnComplete) {
               finalizeTranscript();
               setTimeout(() => setCurrentSubtitle(''), 3000);
            }

            // Audio Playback
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputContextRef.current) {
               const ctx = outputContextRef.current;
               try {
                 const audioData = decode(base64Audio);
                 const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
                 
                 const source = ctx.createBufferSource();
                 source.buffer = audioBuffer;
                 source.playbackRate.value = playbackRateRef.current;

                 const gainNode = ctx.createGain();
                 gainNode.gain.value = 1.0; 
                 
                 source.connect(gainNode);
                 gainNode.connect(ctx.destination);

                 const duration = audioBuffer.duration / playbackRateRef.current;
                 const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
                 source.start(startTime);
                 nextStartTimeRef.current = startTime + duration;
                 
                 activeSourcesRef.current.add(source);
                 
                 setIsModelSpeaking(true);
                 source.onended = () => {
                   activeSourcesRef.current.delete(source);
                   if (activeSourcesRef.current.size === 0) {
                     setIsModelSpeaking(false);
                   }
                 };

               } catch (err) {
                 console.error("Audio Decode Error", err);
               }
            }
            
            if (msg.serverContent?.interrupted) {
               activeSourcesRef.current.forEach(src => src.stop());
               activeSourcesRef.current.clear();
               nextStartTimeRef.current = outputContextRef.current?.currentTime || 0;
               setIsModelSpeaking(false);
               setCurrentSubtitle('');
            }
          },
          onclose: (e) => {
            console.log("Connection closed", e);
            setConnectionState((prev) => {
                if (prev === 'connected') {
                     handleHangUp('remote', "Собеседник завершил звонок.");
                }
                return prev;
            });
          },
          onerror: (e) => {
            console.error("Session Error", e);
            if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
            // More specific error messaging based on typical API failure patterns
            const errorMsg = "Ошибка доступа. Проверьте ваш API ключ и лимиты.";
            handleHangUp('error', errorMsg);
          }
        }
      });

    } catch (error: any) {
      console.error("Connection logic error", error);
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      handleHangUp('error', "Ошибка запуска. Проверьте API ключ.");
    }
  };

  const updateTranscript = (role: 'user' | 'model', text: string, isPartial: boolean) => {
    setTranscripts(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && last.isPartial) {
        const updated = { ...last, text: last.text + text };
        return [...prev.slice(0, -1), updated];
      } else {
        return [...prev, {
          id: Date.now().toString(),
          role,
          text,
          timestamp: new Date(),
          isPartial: true
        }];
      }
    });
  };

  const finalizeTranscript = () => {
    setTranscripts(prev => prev.map(t => ({ ...t, isPartial: false })));
  };

  const currentVoice = VOICES.find(v => v.name === config.voiceName) || VOICES[0];
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, showChat]);

  // --- Rendering Helpers ---

  const getStatusDisplay = () => {
    switch (connectionState) {
      case 'connecting': return { text: 'Звоню...', color: 'bg-yellow-500 animate-pulse' };
      case 'connected': return { text: 'В эфире', color: 'bg-green-500 animate-pulse' };
      case 'error': return { text: 'Ошибка', color: 'bg-red-500' };
      default: return { text: 'Ожидание', color: 'bg-slate-500' };
    }
  };
  const status = getStatusDisplay();

  // If call ended with a reason (Error or Manual Hangup), show Summary Screen
  if (endReason && connectionState === 'disconnected') {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center p-6 relative">
          <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 text-center shadow-2xl border border-slate-700 animate-fade-in-up">
              {endReason === 'error' ? (
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertCircle className="w-10 h-10 text-red-500" />
                  </div>
              ) : (
                  <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                      <PhoneOff className="w-10 h-10 text-slate-400" />
                  </div>
              )}
              
              <h2 className="text-2xl font-bold text-white mb-2">
                  {endReason === 'error' ? 'Ошибка связи' : 'Звонок завершен'}
              </h2>
              
              <p className="text-slate-400 mb-8">
                  {errorMsg || "Сеанс связи с репетитором окончен."}
              </p>
              
              <div className="space-y-3">
                  <button 
                    onClick={connect}
                    className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all"
                  >
                    Перезвонить
                  </button>
                  <button 
                    onClick={handleReset}
                    className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all"
                  >
                    На главный экран
                  </button>
              </div>
          </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col font-sans">
      
      {/* BACKGROUND AVATAR LAYER */}
      <div className="absolute inset-0 z-0 transition-opacity duration-1000">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 z-10" />
        <img 
          src={currentVoice.avatarUrl} 
          alt="Tutor Avatar"
          className={`w-full h-full object-cover object-top transition-transform duration-[2000ms] ease-in-out ${isModelSpeaking ? 'scale-105' : 'scale-100'}`}
        />
      </div>

      {/* HEADER */}
      <div className="relative z-20 flex justify-between items-center p-6">
        <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
           <div className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
           <span className="text-white/90 font-medium text-xs uppercase tracking-wider">
             {status.text}
           </span>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={() => setShowHelp(true)}
             className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors"
           >
             <HelpCircle className="w-5 h-5" />
           </button>
           {connectionState === 'connected' && (
             <button 
               onClick={() => setShowChat(!showChat)}
               className={`p-3 rounded-full backdrop-blur-md transition-colors ${showChat ? 'bg-white text-black' : 'bg-black/40 text-white hover:bg-black/60'}`}
             >
               <MessageSquare className="w-5 h-5" />
             </button>
           )}
           <button 
             onClick={() => setShowSettings(!showSettings)}
             className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors"
           >
             <Settings className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* HELP MODAL */}
      {showHelp && (
          <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
              <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 relative">
                  <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"><X /></button>
                  <h2 className="text-2xl font-bold text-white mb-6">Как это работает?</h2>
                  
                  <div className="space-y-6">
                      <div className="flex gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                              <Phone className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                              <h3 className="text-white font-semibold mb-1">Симулятор звонка</h3>
                              <p className="text-slate-400 text-sm">Вы звоните Искусственному Интеллекту. Он говорит голосом в реальном времени.</p>
                          </div>
                      </div>

                      <div className="flex gap-4">
                          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                              <h3 className="text-white font-semibold mb-1">Говорите свободно</h3>
                              <p className="text-slate-400 text-sm">Не нужно нажимать кнопки, чтобы сказать. Просто говорите, как по телефону.</p>
                          </div>
                      </div>

                      <div className="flex gap-4">
                          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                              <MessageSquare className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                              <h3 className="text-white font-semibold mb-1">Русский и Датский</h3>
                              <p className="text-slate-400 text-sm">Учитель знает русский. Если сложно - скажите "СТОП" или "НЕ ПОНИМАЮ".</p>
                          </div>
                      </div>
                  </div>
                  
                  <button onClick={() => setShowHelp(false)} className="w-full mt-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-slate-200">
                      Понятно
                  </button>
              </div>
          </div>
      )}

      {/* ERROR BANNER (Small floating) */}
      {errorMsg && !endReason && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-red-600/95 text-white px-6 py-4 rounded-2xl shadow-xl text-sm backdrop-blur-md flex items-center gap-3 max-w-[90%]">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-white/20 rounded"><X size={16} /></button>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-6">
        {connectionState === 'disconnected' ? (
          <div className="text-center space-y-8 animate-fade-in-up">
            <div>
                 <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-2xl tracking-tighter mb-2">
                   Lær Dansk
                 </h1>
                 <p className="text-white/60 text-sm uppercase tracking-widest font-medium">AI Language Simulator</p>
            </div>
            
            <p className="text-slate-200 text-lg max-w-md mx-auto leading-relaxed font-light">
              Ваш виртуальный репетитор <span className="font-semibold text-red-400">{currentVoice.description.split(' ')[0]}</span> онлайн.
              <br/>Нажмите кнопку, чтобы начать урок.
            </p>
            
            <button 
              onClick={connect}
              className="group relative inline-flex items-center justify-center px-10 py-5 text-xl font-bold text-white transition-all duration-200 bg-green-600 rounded-full focus:outline-none focus:ring-4 focus:ring-green-900 hover:bg-green-500 hover:scale-105 shadow-[0_0_40px_rgba(34,197,94,0.4)]"
            >
              <Phone className="w-7 h-7 mr-3 fill-current animate-pulse" />
              Начать Урок
            </button>
          </div>
        ) : (
          <div className="w-full max-w-2xl text-center space-y-8">
            
            {/* CONNECTING STATE */}
            {connectionState === 'connecting' && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-30 rounded-3xl">
                   <Loader2 className="w-16 h-16 text-white mb-6 animate-spin" />
                   <p className="text-white text-xl font-medium">{connectionStep}</p>
                   <button 
                     onClick={() => handleHangUp('user', 'Отмена соединения')}
                     className="mt-8 px-6 py-2 border border-white/30 rounded-full text-white/70 hover:bg-white/10 text-sm"
                   >
                     Отмена
                   </button>
               </div>
            )}
            
            {/* VISUALIZER & SUBTITLES */}
            <div className={`transition-opacity duration-500 ${connectionState === 'connected' ? 'opacity-100' : 'opacity-0'}`}>
                <div className="h-32 flex items-center justify-center mb-8">
                   <Visualizer isActive={isModelSpeaking} color="bg-red-400" barCount={16} />
                </div>
                
                <div className="min-h-[4rem] flex items-center justify-center">
                   {currentSubtitle ? (
                     <p className="text-2xl md:text-3xl font-medium text-white drop-shadow-lg leading-tight animate-fade-in transition-all px-6 py-4 bg-black/60 rounded-2xl backdrop-blur-md border border-white/10">
                       "{currentSubtitle}"
                     </p>
                   ) : (
                     connectionState === 'connected' && <p className="text-white/40 italic text-sm bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm">Слушаю вас...</p>
                   )}
                </div>
            </div>
          </div>
        )}
      </div>

      {/* SETTINGS DRAWER */}
      {showSettings && (
        <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
           <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl relative">
              <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"><X /></button>
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-red-500" /> Настройки
              </h2>
              
              <div className="space-y-6">
                <div>
                   {/* API Key management removed as it is now handled externally */}

                  <label className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-3 block">Репетитор</label>
                  <div className="grid grid-cols-2 gap-3">
                    {VOICES.map(voice => (
                      <button
                        key={voice.name}
                        onClick={() => setConfig(prev => ({...prev, voiceName: voice.name}))}
                        className={`relative overflow-hidden rounded-xl h-24 text-left transition-all ${config.voiceName === voice.name ? 'ring-2 ring-red-500 scale-[1.02]' : 'opacity-60 hover:opacity-100'}`}
                      >
                         <img src={voice.avatarUrl} className="absolute inset-0 w-full h-full object-cover" alt="" />
                         <div className="absolute inset-0 bg-black/50" />
                         <div className="absolute bottom-2 left-2 right-2">
                            <div className="font-bold text-white text-sm">{voice.gender === 'Female' ? 'Метте' : 'Мадс'}</div>
                            <div className="text-[10px] text-slate-300">{voice.description.split(' ')[1]}</div>
                         </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                   <label className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-3 block">
                     Скорость речи ИИ: {config.playbackRate}x
                   </label>
                   <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-xl">
                      <span className="text-xs text-slate-400">Медленно</span>
                      <input 
                        type="range" min="0.7" max="1.3" step="0.1"
                        value={config.playbackRate}
                        onChange={(e) => setConfig(prev => ({...prev, playbackRate: parseFloat(e.target.value)}))}
                        className="flex-1 accent-red-500 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs text-slate-400">Быстро</span>
                   </div>
                </div>
              </div>
              
              <button onClick={() => setShowSettings(false)} className="w-full mt-8 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors">
                Сохранить
              </button>
           </div>
        </div>
      )}

      {/* CHAT OVERLAY */}
      {showChat && (
        <div className="absolute inset-0 z-30 pt-24 pb-32 px-4 bg-black/95 backdrop-blur-md overflow-y-auto">
           <div className="max-w-xl mx-auto space-y-4">
             {transcripts.length === 0 && (
               <p className="text-center text-slate-500 mt-10">История пуста. Скажите что-нибудь!</p>
             )}
             {transcripts.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   {msg.role === 'model' && (
                     <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-700">
                       <img src={currentVoice.avatarUrl} className="w-full h-full object-cover" />
                     </div>
                   )}
                   <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${
                     msg.role === 'user' 
                     ? 'bg-red-600 text-white rounded-tr-none' 
                     : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                   }`}>
                     {msg.text}
                   </div>
                </div>
             ))}
             <div ref={chatEndRef} />
           </div>
        </div>
      )}

      {/* BOTTOM CONTROLS */}
      {connectionState === 'connected' && (
        <div className="relative z-40 p-8 pb-10 flex justify-center items-center gap-8 animate-fade-in-up">
           
           <button 
             onClick={() => setMicEnabled(!micEnabled)}
             className={`p-5 rounded-full transition-all duration-300 ${micEnabled ? 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-md' : 'bg-white text-black'}`}
           >
             {micEnabled ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
           </button>

           <button 
             onClick={() => handleHangUp('user')}
             className="p-6 bg-red-600 hover:bg-red-700 text-white w-24 h-24 rounded-full shadow-[0_0_40px_rgba(220,38,38,0.5)] transform hover:scale-105 transition-all duration-300 flex items-center justify-center"
           >
             <PhoneOff className="w-10 h-10 fill-current" />
           </button>

           <div className="relative">
             <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${isUserSpeaking ? 'bg-green-500' : 'bg-transparent'} transition-colors`} />
             <div className="p-5 rounded-full bg-white/10 backdrop-blur-md text-white/50 cursor-default">
                <Volume2 className="w-7 h-7" />
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default LiveSession;
