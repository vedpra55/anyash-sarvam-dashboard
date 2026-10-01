import { SupportedLanguage } from "./types";

export const LANGUAGES: { id: SupportedLanguage; label: string; nativeName: string }[] = [
  { id: "Hindi", label: "Hindi", nativeName: "हिंदी" },
  { id: "English", label: "English", nativeName: "English" },
  { id: "Hinglish", label: "Hinglish", nativeName: "हिंग्लिश" },
  { id: "Tamil", label: "Tamil", nativeName: "தமிழ்" },
  { id: "Telugu", label: "Telugu", nativeName: "తెలుగు" },
  { id: "Kannada", label: "Kannada", nativeName: "ಕನ್ನಡ" },
  { id: "Marathi", label: "Marathi", nativeName: "मराठी" },
  { id: "Bengali", label: "Bengali", nativeName: "বাংলা" },
  { id: "Gujarati", label: "Gujarati", nativeName: "ગુજરાતી" },
  { id: "Punjabi", label: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { id: "Malayalam", label: "Malayalam", nativeName: "മലയാളം" },
  { id: "Odia", label: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { id: "Assamese", label: "Assamese", nativeName: "অসমীয়া" },
];

export const RELATIONSHIPS = ["Daughter", "Son", "Daughter-in-law", "Son-in-law", "Grandchild", "Other"];

export function formatPhone(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = raw.replace(/\s+/g, "");
  if (cleaned.startsWith("+91") && cleaned.length === 13) {
    return `+91 ${cleaned.slice(3, 8)} ${cleaned.slice(8)}`;
  }
  return raw.trim();
}
