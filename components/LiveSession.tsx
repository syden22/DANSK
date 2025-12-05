
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, PhoneOff, Settings, MessageSquare, X, Phone, LogOut, Globe } from 'lucide-react';
import { createBlob, decode, decodeAudioData } from '../utils/audio';
import Visualizer from './Visualizer';
import { ChatMessage, ConnectionState, AudioConfig, VOICES } from '../types';

interface LiveSessionProps {
  apiKey: string;
  onLogout: () => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ apiKey, onLogout }) => {
  // --- STATE ---
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [transcripts, setTranscripts] = useState<ChatMessage[]>([]);
  const [config, setConfig] = useState<AudioConfig>({ voiceName: 'Kore', playbackRate: 1.0 });
  const [activeSubtitle, setActiveSubtitle] = useState('');
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);

  // --- REFS ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const activeSources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextPlayTime = useRef(0);

  // --- CLEANUP ---
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    activeSources.current.forEach(src => {
      try { src.stop(); } catch(e) {}
    });
    activeSources.current.clear();
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsModelSpeaking(false);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // --- LOGIC: START CALL ---
  const startCall = async () => {
    cleanup();
    setConnectionState('connecting');
    setErrorMsg(null);

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 24000 });
      await ctx.resume();
      audioContextRef.current = ctx;
      nextPlayTime.current = ctx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey });
      const currentVoiceProfile = VOICES.find(v => v.name === config.voiceName);
      const tutorName = currentVoiceProfile?.description.split(' ')[0] || 'Mette';

      // *** PROFESSIONAL PEDAGOGICAL INSTRUCTION ***
      const systemInstruction = `
        Role: You are ${tutorName}, an elite, native Danish language tutor teaching a Russian-speaking student.
        
        GOAL: To conduct a natural, engaging conversation that improves the user's Danish skills, using Russian only as a precise tool for explanation.

        BEHAVIORAL GUIDELINES:
        1. **The "Sandwich" Method (CRITICAL):** 
           - If the user struggles or asks for help, DO NOT just switch to Russian permanently.
           - Structure: [Short Russian Explanation] -> [Danish Phrase to Practice].
           - Example User: "I don't understand 'hygge'."
           - Example You: "Это уют, который создается атмосферой. Скажи: 'Det er meget hyggeligt'."

        2. **Proactive Conversation:**
           - Do not wait for the user to lead.
           - actively ask questions about their life, work, opinions, or the environment.
           - If the conversation stalls, propose a new simple topic (e.g., food, travel, daily routine).

        3. **Correction Strategy:**
           - If the user makes a small mistake, repeat their sentence back to them CORRECTLY in your reply without lecturing.
           - If the user makes a big mistake, briefly explain the grammar in Russian, then ask them to try again in Danish.

        4. **Language Balance:**
           - Default state: Speak clear, slightly slow Danish.
           - If user speaks Russian: Answer their question in Russian, BUT immediately ask a follow-up question in Danish to switch the mode back.

        5. **Personality:**
           - Friendly, patient, encouraging. You are a real person, not a robot. Use fillers like "Nå...", "Ja...", "Spændende".

        RESTRICTIONS:
        - Keep responses CONCISE (maximum 2-3 sentences). This is a dialogue, not a monologue.
      `;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } },
          },
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
          systemInstruction: systemInstruction,
        },
        callbacks: {
          onopen: () => {
            setConnectionState('connected');
            
            // Audio Input Setup
            const inputCtx = new AudioContextClass({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            inputSourceRef.current = source;
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (!isMicOn) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const blob = createBlob(inputData);
              sessionPromise.then(sess => sess.sendRealtimeInput({ media: blob }));
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              const buffer = await decodeAudioData(decode(audioData), audioContextRef.current);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.playbackRate.value = config.playbackRate;
              source.connect(audioContextRef.current.destination);
              
              const start = Math.max(nextPlayTime.current, audioContextRef.current.currentTime);
              source.start(start);
              nextPlayTime.current = start + (buffer.duration / config.playbackRate);
              
              activeSources.current.add(source);
              setIsModelSpeaking(true);
              
              source.onended = () => {
                activeSources.current.delete(source);
                if (activeSources.current.size === 0) setIsModelSpeaking(false);
              };
            }

            // Subtitles
            const text = msg.serverContent?.outputTranscription?.text;
            if (text) {
              setActiveSubtitle(text);
              setTranscripts(prev => [...prev, { id: Date.now().toString(), role: 'model', text, timestamp: new Date() }]);
            }

            // Interruption handling
            if (msg.serverContent?.interrupted) {
               activeSources.current.forEach(s => s.stop());
               activeSources.current.clear();
               setIsModelSpeaking(false);
               nextPlayTime.current = 0;
            }
          },
          onclose: () => setConnectionState('disconnected'),
          onerror: (err) => {
            console.error(err);
            setErrorMsg("Ошибка подключения. Проверьте лимиты ключа или интернет.");
            setConnectionState('error');
            cleanup();
          }
        }
      });

    } catch (e: any) {
      setErrorMsg("Не удалось запустить аудио. Разрешите доступ к микрофону.");
      setConnectionState('error');
      cleanup();
    }
  };

  const endCall = () => {
    cleanup();
    setConnectionState('disconnected');
    setActiveSubtitle('');
  };

  const currentVoice = VOICES.find(v => v.name === config.voiceName) || VOICES[0];

  // --- RENDER ---
  return (
    <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col font-sans text-slate-100">
      
      {/* 1. ЖИВОЙ АВАТАР (ФОН) */}
      <div className="absolute inset-0 z-0 select-none">
         <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 z-10" />
         <img 
           src={currentVoice.avatarUrl} 
           className={`w-full h-full object-cover object-top transition-transform duration-[2000ms] ease-in-out ${isModelSpeaking ? 'scale-110' : 'scale-100'}`}
           alt="Tutor Avatar"
         />
      </div>

      {/* 2. ВЕРХНЯЯ ПАНЕЛЬ */}
      <div className="relative z-20 p-4 flex justify-between items-center safe-area-top">
         <button onClick={onLogout} className="p-3 bg-black/40 backdrop-blur-xl rounded-full hover:bg-white/20 transition border border-white/5">
            <LogOut size={20} className="text-white/80" />
         </button>
         
         <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 border ${connectionState === 'connected' ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-slate-500/20 border-slate-500/30 text-slate-400'}`}>
            <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
            {connectionState === 'connected' ? 'LIVE' : connectionState === 'connecting' ? 'CONNECTING' : 'READY'}
         </div>

         <button onClick={() => setShowSettings(!showSettings)} className="p-3 bg-black/40 backdrop-blur-xl rounded-full hover:bg-white/20 transition border border-white/5">
            <Settings size={20} className="text-white/80" />
         </button>
      </div>

      {/* 3. ОШИБКИ */}
      {errorMsg && (
        <div className="absolute top-20 left-4 right-4 z-50 bg-red-500/90 text-white p-4 rounded-2xl shadow-2xl backdrop-blur animate-bounce-in text-center border border-red-400/50">
          <div className="font-bold mb-1">Ошибка связи</div>
          <div className="text-sm opacity-90">{errorMsg}</div>
          <button onClick={() => setErrorMsg(null)} className="absolute top-2 right-2 p-1 hover:bg-black/20 rounded-full"><X size={16}/></button>
        </div>
      )}

      {/* 4. ЦЕНТРАЛЬНАЯ ЗОНА */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-6 pb-32">
        
        {connectionState === 'disconnected' || connectionState === 'error' ? (
          <div className="text-center space-y-8 animate-fade-in-up">
            <div>
              <h2 className="text-5xl font-bold mb-2 tracking-tight text-white drop-shadow-lg">{currentVoice.description.split(' ')[0]}</h2>
              <p className="text-slate-300 text-lg font-medium tracking-wide opacity-80">{currentVoice.description.split('(')[1].replace(')', '')}</p>
            </div>
            
            <button 
              onClick={startCall}
              className="group relative px-12 py-6 bg-green-600 hover:bg-green-500 rounded-full text-2xl font-bold shadow-[0_0_60px_rgba(22,163,74,0.3)] transition-all hover:scale-105 active:scale-95 flex items-center gap-4 mx-auto overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <Phone className="w-8 h-8 fill-current" />
              <span>Начать урок</span>
            </button>
          </div>
        ) : (
          <div className="w-full max-w-lg flex flex-col items-center space-y-8">
            {/* Визуализатор Голоса */}
            <div className="h-20 flex items-end justify-center pb-4">
               <Visualizer isActive={isModelSpeaking} color="bg-green-400" barCount={20} />
            </div>

            {/* Субтитры */}
            <div className="w-full min-h-[120px] flex items-center justify-center">
               {activeSubtitle ? (
                 <div className="text-center animate-fade-in">
                   <p className="inline-block text-xl md:text-2xl font-medium leading-relaxed text-white drop-shadow-md bg-black/60 px-6 py-4 rounded-3xl backdrop-blur-md border border-white/10">
                     {activeSubtitle}
                   </p>
                 </div>
               ) : (
                 <p className="text-slate-400/50 text-sm font-medium uppercase tracking-widest animate-pulse">Слушаю вас...</p>
               )}
            </div>
          </div>
        )}
      </div>

      {/* 5. НИЖНЯЯ ПАНЕЛЬ УПРАВЛЕНИЯ */}
      {connectionState === 'connected' && (
        <div className="absolute bottom-10 left-0 right-0 z-30 flex justify-center items-center gap-8 px-6">
           {/* Микрофон */}
           <button 
             onClick={() => setIsMicOn(!isMicOn)}
             className={`p-5 rounded-full backdrop-blur-xl border transition-all duration-300 ${isMicOn ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-red-500/20 border-red-500 text-red-500'}`}
           >
             {isMicOn ? <Mic size={28} /> : <MicOff size={28} />}
           </button>

           {/* Сброс звонка */}
           <button 
             onClick={endCall}
             className="p-7 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-2xl shadow-red-900/50 transform hover:scale-105 active:scale-95 transition-all border-4 border-black/20"
           >
             <PhoneOff size={36} fill="currentColor" />
           </button>

           {/* Чат */}
           <button 
             onClick={() => setShowChat(!showChat)}
             className={`p-5 rounded-full backdrop-blur-xl border transition-all duration-300 ${showChat ? 'bg-white text-black border-white' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
           >
             <MessageSquare size={28} />
           </button>
        </div>
      )}

      {/* 6. МОДАЛКА НАСТРОЕК */}
      {showSettings && (
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4">
           <div className="w-full sm:max-w-sm bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-white">Параметры урока</h3>
                <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-800 rounded-full"><X size={20}/></button>
              </div>

              <div className="space-y-8">
                {/* Выбор Репетитора */}
                <div>
                   <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-3 block">Выберите репетитора</label>
                   <div className="grid grid-cols-2 gap-3">
                      {VOICES.map(v => (
                        <button 
                          key={v.name}
                          onClick={() => setConfig(prev => ({ ...prev, voiceName: v.name }))}
                          className={`relative p-4 rounded-2xl border text-left transition-all overflow-hidden ${config.voiceName === v.name ? 'border-green-500 bg-green-500/10' : 'border-slate-800 bg-slate-800/50'}`}
                        >
                          <div className="relative z-10">
                            <div className={`font-bold text-lg ${config.voiceName === v.name ? 'text-green-400' : 'text-slate-300'}`}>{v.description.split(' ')[0]}</div>
                            <div className="text-xs text-slate-500 mt-1">{v.gender === 'Female' ? 'Женский голос' : 'Мужской голос'}</div>
                          </div>
                          {config.voiceName === v.name && <div className="absolute inset-0 bg-green-500/5 z-0" />}
                        </button>
                      ))}
                   </div>
                </div>

                {/* Скорость Речи */}
                <div>
                   <div className="flex justify-between mb-3">
                     <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Скорость речи</label>
                     <span className="text-xs font-bold text-green-400">{config.playbackRate}x</span>
                   </div>
                   <input 
                     type="range" min="0.7" max="1.3" step="0.1"
                     value={config.playbackRate}
                     onChange={(e) => setConfig(prev => ({ ...prev, playbackRate: parseFloat(e.target.value) }))}
                     className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-green-500 hover:accent-green-400"
                   />
                   <div className="flex justify-between mt-2 text-[10px] text-slate-600 font-bold uppercase">
                     <span>Медленно</span>
                     <span>Нормально</span>
                     <span>Быстро</span>
                   </div>
                </div>
              </div>

              <button onClick={() => setShowSettings(false)} className="w-full mt-10 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-slate-200 transition">
                Сохранить
              </button>
           </div>
        </div>
      )}

      {/* 7. ИСТОРИЯ ЧАТА */}
      {showChat && (
        <div className="absolute inset-0 z-40 bg-slate-950/95 pt-24 pb-40 px-4 overflow-y-auto animate-fade-in">
           <div className="max-w-md mx-auto space-y-4">
             {transcripts.length === 0 && (
               <div className="text-center mt-20 opacity-50">
                 <MessageSquare size={48} className="mx-auto mb-4 text-slate-600"/>
                 <p>Здесь будет текст диалога</p>
               </div>
             )}
             {transcripts.map(t => (
               <div key={t.id} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`p-4 rounded-2xl text-base max-w-[85%] leading-relaxed ${t.role === 'user' ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-green-900/40 border border-green-500/20 text-green-100 rounded-tl-sm'}`}>
                   {t.text}
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}

    </div>
  );
};

export default LiveSession;
