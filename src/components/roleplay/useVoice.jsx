/**
 * useVoice — Browser-native Speech-to-Text + Text-to-Speech hook
 * Uses Web Speech API: SpeechRecognition (STT) + SpeechSynthesis (TTS)
 * Zero external dependencies, zero latency overhead.
 */
import { useState, useRef, useCallback, useEffect } from "react";

export function useVoice({ onTranscript, voiceSettings }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [interim, setInterim]          = useState("");   // live partial transcript
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  const recognitionRef = useRef(null);
  const utteranceRef   = useRef(null);

  // ── Detect support ──────────────────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setSttSupported(!!SpeechRecognition);
    setTtsSupported(!!window.speechSynthesis);
  }, []);

  // ── Speech-to-Text ──────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous      = true;
    recognition.interimResults  = true;
    recognition.lang            = "en-US";
    recognitionRef.current      = recognition;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let final   = "";
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else partial += t;
      }
      setInterim(partial);
      if (final) {
        setInterim("");
        onTranscript(final.trim());
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterim("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterim("");
    };

    recognition.start();
  }, [onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterim("");
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  // ── Text-to-Speech ──────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !voiceSettings.ttsEnabled) return;
    window.speechSynthesis.cancel();               // stop any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate   = voiceSettings.rate   ?? 0.95;
    utterance.volume = voiceSettings.volume ?? 1;
    utterance.pitch  = voiceSettings.pitch ?? 1.05;

    // Prefer natural, human-like voices
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Google UK English") || v.name.includes("Natural") || v.name.includes("Siri") || v.name.includes("Victoria") || v.name.includes("Alex"))
    ) || voices.find((v) => v.lang.startsWith("en") && !v.name.includes("Google")) || voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [voiceSettings]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    isListening,
    isSpeaking,
    interim,
    sttSupported,
    ttsSupported,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
  };
}