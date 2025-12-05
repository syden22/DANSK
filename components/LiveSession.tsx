
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, PhoneOff, Settings, MessageSquare, X, Volume2, Loader2, HelpCircle, Phone, LogOut, RefreshCcw } from 'lucide-react';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeSources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextPlayTime = useRef(0);

  // --- CLEANUP FUNCTION ---
  const cleanup = useCallback(() => {
    // Stop Microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // Disconnect Audio Nodes
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    // Stop Playback
    activeSources.current.forEach(src => {
      try { src.stop(); } catch(e) {}
    });
    activeSources.current.clear();
    
    // Close Context (Important for "Red Screen" fixes)
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsModelSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // --- START CALL ---
  const startCall = async () => {
    cleanup(); // Safety cleanup before start
    setConnectionState('connecting');
    setErrorMsg(null);

    try {
      // 1. Initialize Audio Context (Must happen after user gesture)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 24000 });
      await ctx.resume();
      audioContextRef.current = ctx;
      nextPlayTime.current = ctx.currentTime;

      // 2. Get Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // 3. Connect to Gemini
      const ai = new GoogleGenAI({ apiKey });
      const currentVoice = config.voiceName === 'Kore' ? 'Mette' : 'Mads';
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `
            You are ${currentVoice}, an immersive Danish language tutor.
            
            CRITICAL INSTRUCTIONS:
            1. **Speak Danish** by default.
            2. **Speak Russian** ONLY if the user asks for translation, says "I don't understand", or speaks Russian to you.
            3. If the user makes a mistake, correct them gently in Danish, then explain in Russian if they are confused.
            4. Keep responses **SHORT**. Maximum 1-2 sentences. Do not monologue. This is a phone call.
            5. If the user says "Stop", stop talking immediately.
          `,
        },
        callbacks: {
          onopen: () => {
            setConnectionState('connected');
            
            // Start Audio Stream Processing
            const inputCtx = new AudioContextClass({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            inputSourceRef.current = source; // Store ref for cleanup
            processorRef.current = processor; // Store ref for cleanup

            processor.onaudioprocess = (e) => {
              if (!isMicOn) return; // Mute logic
              const inputData = e.inputBuffer.getChannelData(0);
              const blob = createBlob(inputData);
              sessionPromise.then(sess => sess.sendRealtimeInput({ media: blob }));
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // 1. Handle Audio
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

            // 2. Handle Text (Subtitles)
            const text = msg.serverContent?.outputTranscription?.text;
            if (text) {
              setActiveSubtitle(text);
              updateHistory('model', text);
            }
            
            // 3. Handle User Transcript
            const userText = msg.serverContent?.inputTranscription?.text;
            if (userText) {
              updateHistory('user', userText);
            }

            // 4. Handle Interruptions
            if (msg.serverContent?.interrupted) {
               activeSources.current.forEach(s => s.stop());
               activeSources.current.clear();
               setIsModelSpeaking(false);
               nextPlayTime.current = audioContextRef.current?.currentTime || 0;
            }
          },
          onclose: () => {
            setConnectionState('disconnected');
          },
          onerror: (err) => {
            console.error(err);
            setErrorMsg("Ошибка соединения. Проверьте ключ.");
            setConnectionState('error');
            cleanup();
          }
        }
      });

    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Не удалось начать звонок.");
      setConnectionState('error');
      cleanup();
    }
  };

  const endCall = () => {
    cleanup();
    setConnectionState('disconnected');
    setActiveSubtitle('');
  };

  const updateHistory = (role: 'user' | 'model', text: string) => {
    setTranscripts(prev => {
      const last = prev[prev.length - 1];
      // Append if same role and recent (simple logic)
      if (last && last.role === role && (Date.now() - last.timestamp.getTime() < 2000)) {
        return [...prev.slice(0, -1), { ...last, text: last.text + " " + text }];
      }
      return [...prev, { id: Date.now().toString(), role, text, timestamp: new Date() }];
    });
  };

  const currentVoice = VOICES.find(v => v.name === config.voiceName) || VOICES[0];

  // --- RENDER ---
  return (
    <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col font-sans text-slate-100">
      
      {/* AVATAR BACKGROUND */}
      <div className="absolute inset-0 z-0">
         <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/90 z-10" />
         <img 
           src={currentVoice.avatarUrl} 
           className={`w-full h-full object-cover object-top transition-transform duration-700 ${isModelSpeaking ? 'scale-105' : 'scale-100'}`}
           alt="Avatar"
         />
      </div>

      {/* HEADER */}
      <div className="relative z-20 p-4 flex justify-between items-center">
         <button onClick={onLogout} className="p-2 bg-black/40 backdrop-blur rounded-full hover:bg-white/20">
            <LogOut size={20} />
         </button>
         
         <div className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${connectionState === 'connected' ? 'bg-green-500/80' : 'bg-slate-500/50'}`}>
            {connectionState === 'connected' ? 'ON AIR' : connectionState === 'connecting' ? 'CONNECTING...' : 'OFFLINE'}
         </div>

         <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-black/40 backdrop-blur rounded-full hover:bg-white/20">
            <Settings size={20} />
         </button>
      </div>

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div className="relative z-50 mx-6 bg-red-600/90 text-white p-4 rounded-xl mb-4 text-center shadow-lg backdrop-blur">
          {errorMsg}
          <button onClick={() => setErrorMsg(null)} className="absolute top-2 right-2"><X size={16}/></button>
        </div>
      )}

      {/* MAIN AREA */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-6">
        
        {connectionState === 'disconnected' || connectionState === 'error' ? (
          <div className="text-center space-y-6 animate-fade-in-up">
            <h2 className="text-4xl font-bold">Готовы начать?</h2>
            <p className="text-slate-300">Нажмите кнопку, чтобы позвонить <span className="text-green-400">{currentVoice.description.split(' ')[0]}</span>.</p>
            <button 
              onClick={startCall}
              className="px-10 py-6 bg-green-600 hover:bg-green-500 rounded-full text-2xl font-bold shadow-[0_0_50px_rgba(22,163,74,0.4)] transition-all hover:scale-105 flex items-center gap-3 mx-auto"
            >
              <Phone className="w-8 h-8 fill-current" />
              Позвонить
            </button>
          </div>
        ) : (
          <div className="w-full max-w-lg space-y-6 text-center">
            {/* Visualizer */}
            <div className="h-24 flex items-center justify-center">
               <Visualizer isActive={isModelSpeaking} color="bg-green-400" barCount={12} />
            </div>

            {/* Subtitles */}
            <div className="min-h-[100px] flex items-center justify-center">
               {activeSubtitle ? (
                 <p className="text-2xl font-medium leading-relaxed drop-shadow-md bg-black/50 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                   {activeSubtitle}
                 </p>
               ) : (
                 <p className="text-slate-400 italic">Слушаю...</p>
               )}
            </div>
          </div>
        )}
      </div>

      {/* CONTROLS (Only when connected) */}
      {connectionState === 'connected' && (
        <div className="relative z-20 pb-10 flex justify-center items-center gap-6">
           <button 
             onClick={() => setIsMicOn(!isMicOn)}
             className={`p-4 rounded-full ${isMicOn ? 'bg-white/10 text-white' : 'bg-white text-black'} backdrop-blur-md transition-all`}
           >
             {isMicOn ? <Mic size={28} /> : <MicOff size={28} />}
           </button>

           <button 
             onClick={endCall}
             className="p-6 bg-red-600 hover:bg-red-500 rounded-full shadow-lg transform hover:scale-105 transition-all"
           >
             <PhoneOff size={32} fill="currentColor" />
           </button>

           <button 
             onClick={() => setShowChat(!showChat)}
             className={`p-4 rounded-full ${showChat ? 'bg-white text-black' : 'bg-white/10 text-white'} backdrop-blur-md transition-all`}
           >
             <MessageSquare size={28} />
           </button>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl p-6 flex items-center justify-center">
           <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Настройки</h3>
                <button onClick={() => setShowSettings(false)}><X /></button>
              </div>

              <div className="space-y-6">
                <div>
                   <label className="text-xs text-slate-500 uppercase font-bold">Голос</label>
                   <div className="grid grid-cols-2 gap-3 mt-2">
                      {VOICES.map(v => (
                        <button 
                          key={v.name}
                          onClick={() => setConfig(prev => ({ ...prev, voiceName: v.name }))}
                          className={`p-3 rounded-xl border text-left ${config.voiceName === v.name ? 'border-green-500 bg-green-500/10' : 'border-slate-700 bg-slate-800'}`}
                        >
                          <div className="font-bold">{v.description.split(' ')[0]}</div>
                          <div className="text-xs text-slate-400">{v.gender}</div>
                        </button>
                      ))}
                   </div>
                </div>

                <div>
                   <label className="text-xs text-slate-500 uppercase font-bold">Скорость: {config.playbackRate}x</label>
                   <input 
                     type="range" min="0.5" max="1.5" step="0.1"
                     value={config.playbackRate}
                     onChange={(e) => setConfig(prev => ({ ...prev, playbackRate: parseFloat(e.target.value) }))}
                     className="w-full mt-3 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                   />
                </div>
              </div>

              <button onClick={() => setShowSettings(false)} className="w-full mt-8 py-3 bg-green-600 rounded-xl font-bold">Готово</button>
           </div>
        </div>
      )}

      {/* CHAT HISTORY */}
      {showChat && (
        <div className="absolute inset-0 z-40 bg-black/95 pt-20 pb-32 px-4 overflow-y-auto">
           <div className="max-w-md mx-auto space-y-3">
             {transcripts.length === 0 && <p className="text-center text-slate-500 mt-10">История пуста</p>}
             {transcripts.map(t => (
               <div key={t.id} className={`p-3 rounded-xl text-sm ${t.role === 'user' ? 'bg-slate-800 ml-auto max-w-[80%]' : 'bg-green-900/30 border border-green-500/30 mr-auto max-w-[80%]'}`}>
                 <div className="text-xs opacity-50 mb-1">{t.role === 'user' ? 'Вы' : 'Репетитор'}</div>
                 {t.text}
               </div>
             ))}
           </div>
        </div>
      )}

    </div>
  );
};

export default LiveSession;
