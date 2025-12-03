

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isPartial?: boolean;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AudioConfig {
  voiceName: string;
  playbackRate: number;
}

export interface VoiceProfile {
  name: string;
  gender: 'Female' | 'Male';
  avatarUrl: string; // URL for the visual persona
  description: string;
}

export const VOICES: VoiceProfile[] = [
  { 
    name: 'Kore', // Updated from Aoede to Kore (valid Live API voice)
    gender: 'Female', 
    description: 'Метте (Чуткий педагог)',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop'
  },
  { 
    name: 'Fenrir', 
    gender: 'Male', 
    description: 'Мадс (Строгий профи)',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=800&auto=format&fit=crop'
  },
];

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
