/**
 * Browser Speech Synthesis utility for Elder Accessibility
 */
export function speakText(text: string): void {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported on this browser.');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9; // Slightly slower, clearer pace for elders
  utterance.pitch = 1.0;
  utterance.lang = 'en-IN'; // Indian English voice preference if available

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
