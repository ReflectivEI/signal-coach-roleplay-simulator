import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const TYPED_TEXT = "Create one, and take it for a spin.";
const PILL_TEXT = "Customize";
const DESC_SPEED = 75;   // ms per char — description
const PILL_SPEED = 1000; // ms per char — one letter per second
const PILL_DELAY = 300;  // ms pause after description finishes before pill starts

export default function BuildYourOwnCard() {
  const [desc, setDesc] = useState("");
  const [pill, setPill] = useState("");
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    // Type description
    let i = 0;
    const descInterval = setInterval(() => {
      i++;
      setDesc(TYPED_TEXT.slice(0, i));
      if (i >= TYPED_TEXT.length) {
        clearInterval(descInterval);
        // After description done, wait then type pill
        setTimeout(() => {
          let j = 0;
          const pillInterval = setInterval(() => {
            j++;
            setPill(PILL_TEXT.slice(0, j));
            if (j >= PILL_TEXT.length) clearInterval(pillInterval);
          }, PILL_SPEED);
        }, PILL_DELAY);
      }
    }, DESC_SPEED);
    return () => clearInterval(descInterval);
  }, []);

  // Blinking cursor — only show while description is still typing
  useEffect(() => {
    const blink = setInterval(() => setCursor(c => !c), 530);
    return () => clearInterval(blink);
  }, []);

  const descDone = desc.length >= TYPED_TEXT.length;

  return (
    <Link
      to="/builder"
      className="flex flex-col gap-3 rounded-2xl"
      style={{
        padding: "0.85rem 1rem",
        background: "hsl(0 60% 90%)",
        border: "1.5px solid hsl(0 70% 70%)",
        animation: "glow-red 2s ease-in-out infinite",
        transition: "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "hsl(0 60% 86%)";
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(180,40,40,0.18)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "hsl(0 60% 90%)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Title + Custom pill */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold leading-tight text-base" style={{ color: "hsl(0 65% 32%)" }}>
          Build Your Own Scenario
        </span>
        {/* Pill: teal matching "Signal Intelligence™ Practice" banner */}
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 mt-0.5"
          style={{
            color: "hsl(162 55% 38%)",
            borderColor: "hsl(162 50% 55%)",
            background: "hsl(162 50% 88%)",
            boxShadow: "0 0 6px 1px hsl(162 60% 45% / 0.4)",
            minWidth: "3.8rem",
            display: "inline-block",
            textAlign: "center",
            letterSpacing: "0.02em",
          }}
        >
          {pill}
          {pill.length > 0 && pill.length < PILL_TEXT.length && (
            <span style={{ opacity: cursor ? 1 : 0 }}>|</span>
          )}
        </span>
      </div>

      {/* Typing animation description + Create button */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold italic" style={{ color: "hsl(162 55% 32%)" }}>
          {desc}
          {!descDone && (
            <span style={{ opacity: cursor ? 1 : 0 }}>|</span>
          )}
        </span>
        <span
          className="py-1 px-4 rounded-full text-xs font-bold whitespace-nowrap shrink-0"
          style={{ background: "hsl(0 65% 48%)", color: "white" }}
        >
          + Create
        </span>
      </div>
    </Link>
  );
}