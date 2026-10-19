// Accepted recording formats (pronunciations, minigame).
export const AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};
export const AUDIO_MIME = Object.fromEntries(Object.entries(AUDIO_TYPES).map(([m, e]) => [e, m]));
export const MAX_AUDIO = 3 * 1024 * 1024;
