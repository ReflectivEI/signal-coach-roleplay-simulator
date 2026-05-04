import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SpeechRecognitionCtor =
    typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

export function useSpeechInput() {
    const recognitionRef = useRef(null);
    const startTimeRef = useRef(0);
    const chunkCountRef = useRef(0);
    const [isSupported] = useState(Boolean(SpeechRecognitionCtor));
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!SpeechRecognitionCtor) return;

        const recognition = new SpeechRecognitionCtor();
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            setIsListening(true);
            startTimeRef.current = Date.now();
            chunkCountRef.current = 0;
            setError("");
        };

        recognition.onresult = (event) => {
            let finalText = "";
            for (let i = 0; i < event.results.length; i += 1) {
                const result = event.results[i];
                finalText += result[0]?.transcript || "";
            }
            chunkCountRef.current += 1;
            setTranscript(finalText.trim());
        };

        recognition.onerror = (evt) => {
            setError(evt?.error || "speech_error");
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.stop();
            recognitionRef.current = null;
        };
    }, []);

    const start = useCallback(() => {
        if (!recognitionRef.current) return;
        setTranscript("");
        recognitionRef.current.start();
    }, []);

    const stop = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    const reset = useCallback(() => {
        setTranscript("");
        setError("");
        startTimeRef.current = 0;
        chunkCountRef.current = 0;
    }, []);

    const voiceMetadata = useMemo(() => {
        const durationSec = Math.max(1, (Date.now() - (startTimeRef.current || Date.now())) / 1000);
        const words = transcript ? transcript.split(/\s+/).filter(Boolean) : [];
        const fillerWords = words.filter((word) => /^(um+|uh+|like|you\s*know)$/i.test(word)).length;
        const questionCount = (transcript.match(/\?/g) || []).length;

        return {
            response_duration_seconds: Number(durationSec.toFixed(2)),
            words_per_minute: Number(((words.length / durationSec) * 60).toFixed(1)),
            pause_count: chunkCountRef.current,
            avg_pause_duration_ms: chunkCountRef.current > 0 ? Math.round((durationSec * 1000) / chunkCountRef.current) : 0,
            filler_word_count: fillerWords,
            filler_word_rate: words.length ? Number((fillerWords / words.length).toFixed(3)) : 0,
            question_count: questionCount,
            speech_confidence_score: transcript ? 0.78 : 0.5,
        };
    }, [transcript]);

    return {
        isSupported,
        isListening,
        transcript,
        error,
        voiceMetadata,
        start,
        stop,
        reset,
        setTranscript,
    };
}
