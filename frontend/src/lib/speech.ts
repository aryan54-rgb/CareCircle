/**
 * Browser Speech Synthesis utility for Elder Accessibility with Multilingual Support (en-IN, hi-IN, mr-IN)
 */
export function speakText(text: string, lang: string = 'en-IN'): void {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported on this browser.');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.88; // Slightly slower, clear pace for elderly listeners
  utterance.pitch = 1.0;
  utterance.lang = lang;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
