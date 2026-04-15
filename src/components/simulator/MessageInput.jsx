import { useState, useRef, useEffect } from "react";
import { Send, Mic } from "lucide-react";

export default function MessageInput({ onSend, disabled, placeholder = "Your response as the rep..." }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
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
    <div className="bg-[hsl(var(--signal-neutral))] p-4 border-t border-border/60">
      <div className="bg-[hsl(var(--card-foreground))] text-[hsl(var(--coaching-muted))] px-4 py-3 rounded-xl flex items-end gap-3 border transition-all duration-200 border-border/60 focus-within:border-primary/40 focus-within:bg-surface-elevated">

        
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "Waiting for HCP response..." : placeholder}
          rows={1} className="bg-transparent text-foreground text-sm leading-relaxed opacity-100 flex-1 placeholder:text-muted-foreground/50 resize-none outline-none min-h-[24px]" />
        
        
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled} className="bg-teal-900 rounded-lg w-8 h-8 flex items-center justify-center shrink-0 transition-all duration-150 hover:bg-primary/80 disabled:opacity-30 disabled:cursor-not-allowed">
          
          
          <Send className="text-slate-50 lucide lucide-send w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-slate-50 mt-1.5 px-1 text-sm">Enter to send · Shift+Enter for new line</p>
    </div>);

}