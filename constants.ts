
import { Language } from './types';

export const LANGUAGES: Language[] = [
  { code: 'auto', name: 'Auto-Detect', flag: '🔍' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
];

export const TRANSLATION_TONES = [
  { id: 'professional', name: 'Professional', icon: '💼', description: 'Business & General' },
  { id: 'legal', name: 'Legal', icon: '⚖️', description: 'Contracts & Compliance' },
  { id: 'technical', name: 'Technical', icon: '⚙️', description: 'Manuals & Code' },
  { id: 'medical', name: 'Medical', icon: '🩺', description: 'Healthcare & Pharma' },
  { id: 'creative', name: 'Creative', icon: '🎨', description: 'Marketing & UI' },
] as const;

export const APP_NAME = "ReTrans";
export const GEMINI_MODEL = "gemini-3-flash-preview";
