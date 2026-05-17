import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

export function formatScenarioText(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export const isIframe = window.self !== window.top;
