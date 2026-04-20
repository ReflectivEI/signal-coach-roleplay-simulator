import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

export default function MessageInput({ onSend, disabled, placeholder = "Your response as the rep..." }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);
  const shouldRestoreFocusRef = useRef(false);

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

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    shouldRestoreFocusRef.current = true;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="p-4 border-t"
      style={{
        background: "linear-gradient(180deg, rgba(226, 241, 240, 0.72) 0%, rgba(241,248,249,0.92) 100%)",
        borderColor: "rgba(131, 164, 186, 0.22)",
      }}
    >
      <div
        className="px-4 py-3 rounded-[22px] flex items-end gap-3 border transition-all duration-200"
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
        
        
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled} className="rounded-xl w-9 h-9 flex items-center justify-center shrink-0 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: "hsl(222 52% 24%)", boxShadow: "0 10px 20px rgba(28, 52, 88, 0.18)" }}>
          
          
          <Send className="text-slate-50 lucide lucide-send w-3.5 h-3.5" />
        </button>
      </div>
      <p className="mt-1.5 px-1 text-xs" style={{ color: "hsl(215 18% 46%)" }}>Enter to send · Shift+Enter for new line</p>
    </div>);

}
