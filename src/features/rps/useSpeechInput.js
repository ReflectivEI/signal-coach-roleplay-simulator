import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const browserWindow = /** @type {any} */ (typeof window !== "undefined" ? window : null);
const SpeechRecognitionCtor =
    browserWindow
        ? browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition
        : null;

export function useSpeechInput() {
    const recognitionRef = useRef(null);
    const startTimeRef = useRef(0);
    const activeStartedAtRef = useRef(0);
    const accumulatedMsRef = useRef(0);
    const baseTranscriptRef = useRef("");
    const chunkCountRef = useRef(0);
    const pauseCountRef = useRef(0);
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
            const now = Date.now();
            if (!startTimeRef.current) startTimeRef.current = now;
            activeStartedAtRef.current = now;
            setError("");
        };

        recognition.onresult = (event) => {
            let finalText = "";
            for (let i = 0; i < event.results.length; i += 1) {
                const result = event.results[i];
                finalText += result[0]?.transcript || "";
            }
            chunkCountRef.current += 1;
            const combined = `${baseTranscriptRef.current} ${finalText}`.replace(/\s+/g, " ").trim();
            setTranscript(combined);
        };

        recognition.onerror = (evt) => {
            setError(evt?.error || "speech_error");
            setIsListening(false);
        };

        recognition.onend = () => {
            if (activeStartedAtRef.current) {
                accumulatedMsRef.current += Date.now() - activeStartedAtRef.current;
                activeStartedAtRef.current = 0;
            }
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.stop();
            recognitionRef.current = null;
        };
    }, []);

    const start = useCallback((options = {}) => {
        if (!recognitionRef.current) return;
        const preserveTranscript = Boolean(options.preserveTranscript);
        if (!preserveTranscript) {
            setTranscript("");
            baseTranscriptRef.current = "";
            accumulatedMsRef.current = 0;
            startTimeRef.current = 0;
            chunkCountRef.current = 0;
            pauseCountRef.current = 0;
        } else {
            baseTranscriptRef.current = transcript.trim();
        }
        try {
            recognitionRef.current.start();
        } catch (err) {
            if (err?.name !== "InvalidStateError") {
                setError(err?.message || "speech_start_error");
            }
        }
    }, [transcript]);

    const resume = useCallback(() => {
        start({ preserveTranscript: true });
    }, [start]);

    const pause = useCallback(() => {
        if (!recognitionRef.current) return;
        pauseCountRef.current += 1;
        recognitionRef.current.stop();
    }, []);

    const stop = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    const reset = useCallback(() => {
        setTranscript("");
        setError("");
        startTimeRef.current = 0;
        activeStartedAtRef.current = 0;
        accumulatedMsRef.current = 0;
        baseTranscriptRef.current = "";
        chunkCountRef.current = 0;
        pauseCountRef.current = 0;
    }, []);

    const voiceMetadata = useMemo(() => {
        const activeMs = activeStartedAtRef.current ? Date.now() - activeStartedAtRef.current : 0;
        const durationSec = Math.max(1, (accumulatedMsRef.current + activeMs) / 1000);
        const words = transcript ? transcript.split(/\s+/).filter(Boolean) : [];
        const fillerWordMatches = transcript.match(/\b(um+|uh+|like|you know|sort of|kind of)\b/gi) || [];
        const questionCount = (transcript.match(/\?/g) || []).length;

        return {
            response_duration_seconds: Number(durationSec.toFixed(2)),
            words_per_minute: Number(((words.length / durationSec) * 60).toFixed(1)),
            pause_count: pauseCountRef.current,
            recognition_chunk_count: chunkCountRef.current,
            avg_pause_duration_ms: pauseCountRef.current > 0 ? Math.round((durationSec * 1000) / Math.max(1, pauseCountRef.current + 1)) : 0,
            filler_word_count: fillerWordMatches.length,
            filler_word_rate: words.length ? Number((fillerWordMatches.length / words.length).toFixed(3)) : 0,
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
        pause,
        resume,
        stop,
        reset,
        setTranscript,
    };
}
