import { useState, useRef, useEffect } from "react";
import { AlertCircle, Mic, Pause, Play, Send } from "lucide-react";
import { useSpeechInput } from "@/features/rps/useSpeechInput";

export default function MessageInput({
  onSend,
  disabled,
  placeholder = "Your response as the rep...",
  onVoiceMetadataChange = null,
  onDraftChange = null,
  draftToApply = null,
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);
  const shouldRestoreFocusRef = useRef(false);
  const speech = useSpeechInput();
  const [voiceMode, setVoiceMode] = useState(false);

  useEffect(() => {
    if (draftToApply?.text) {
      setValue(draftToApply.text);
      window.requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
    }
  }, [draftToApply?.id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  useEffect(() => {
    if (!disabled && shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!textareaRef.current) return;
          textareaRef.current.focus({ preventScroll: true });
          const end = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(end, end);
        });
      });
    }
  }, [disabled]);

  useEffect(() => {
    if (!speech.transcript) return;
    setValue(speech.transcript);
  }, [speech.transcript]);

  useEffect(() => {
    onVoiceMetadataChange?.(speech.voiceMetadata);
  }, [onVoiceMetadataChange, speech.voiceMetadata]);

  const buildInputPayload = () => {
    const voiceMetadata = speech.transcript.trim()
      ? {
          ...speech.voiceMetadata,
          transcript_source: "speech_recognition",
        }
      : null;
    return {
      text: value.trim(),
      inputMode: voiceMetadata ? "voice" : "typed",
      voiceMetadata,
    };
  };

  useEffect(() => {
    onDraftChange?.(buildInputPayload());
  }, [value, speech.transcript, speech.voiceMetadata, onDraftChange]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    shouldRestoreFocusRef.current = true;
    const { voiceMetadata } = buildInputPayload();
    if (speech.isListening) speech.stop();
    onSend(trimmed, {
      inputMode: voiceMetadata ? "voice" : "typed",
      voiceMetadata,
    });
    speech.reset();
    setVoiceMode(false);
    setValue("");
  };

  const startVoice = () => {
    if (disabled || !speech.isSupported) return;
    setVoiceMode(true);
    speech.start();
    window.requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
  };

  const toggleVoicePause = () => {
    if (disabled || !speech.isSupported || !voiceMode) return;
    if (speech.isListening) speech.pause();
    else speech.resume();
  };

  const handleKeyDown = (e) => {
    if (voiceMode && speech.isSupported && e.code === "Space" && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      toggleVoicePause();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="px-4 pb-3 pt-5 border-t absolute bottom-0 left-0 right-0 z-10"
      style={{
        background: "linear-gradient(180deg, rgba(226, 241, 240, 0.72) 0%, rgba(241,248,249,0.92) 100%)",
        borderColor: "rgba(131, 164, 186, 0.22)",
      }}
    >
      <div
        className="px-3.5 py-2.5 rounded-[22px] flex items-end gap-3 border transition-all duration-200"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,251,252,0.98) 100%)",
          borderColor: "rgba(28, 52, 88, 0.22)",
          boxShadow: "0 10px 24px rgba(14, 24, 43, 0.04)",
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "Waiting for HCP response..." : placeholder}
          rows={1} className="bg-transparent text-sm leading-relaxed opacity-100 flex-1 resize-none outline-none min-h-[24px]"
          style={{ color: "hsl(222 30% 22%)" }} />

        {speech.isSupported && (
          <button
            type="button"
            onClick={() => {
              if (disabled) return;
              if (!voiceMode) startVoice();
              else toggleVoicePause();
            }}
            disabled={disabled}
            aria-label={!voiceMode ? "Start voice input" : speech.isListening ? "Pause voice input" : "Resume voice input"}
            title={!voiceMode ? "Start voice input" : speech.isListening ? "Pause voice input" : "Resume voice input"}
            className="rounded-xl w-9 h-9 flex items-center justify-center shrink-0 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: speech.isListening ? "rgba(37, 124, 123, 0.16)" : voiceMode ? "rgba(28, 52, 88, 0.10)" : "rgba(37, 124, 123, 0.12)",
              color: speech.isListening ? "hsl(180 45% 28%)" : "hsl(222 52% 24%)",
              border: speech.isListening ? "1px solid rgba(37, 124, 123, 0.26)" : "1px solid rgba(28, 52, 88, 0.18)",
            }}
          >
            {!voiceMode ? <Mic className="w-3.5 h-3.5" /> : speech.isListening ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled} className="rounded-xl w-9 h-9 flex items-center justify-center shrink-0 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: "hsl(222 52% 24%)", boxShadow: "0 10px 20px rgba(28, 52, 88, 0.18)" }}>
          
          
          <Send className="text-slate-50 lucide lucide-send w-3.5 h-3.5" />
        </button>
      </div>
      <div className="mt-1 px-1 flex items-center justify-end gap-3 text-xs" style={{ color: "hsl(215 18% 46%)" }}>
        {speech.isSupported && voiceMode && (
          <p className="shrink-0">
            {speech.isListening ? "Recording · Space pauses" : "Paused · Space resumes"}
          </p>
        )}
        {!speech.isSupported && (
          <p className="shrink-0 inline-flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Voice unavailable
          </p>
        )}
      </div>
      {speech.error ? (
        <p className="mt-1 px-1 text-xs" style={{ color: "hsl(356 56% 42%)" }}>
          Voice input error: {speech.error}
        </p>
      ) : null}
    </div>);

}
