import React from "react";
import { Link } from "react-router-dom";

/**
 * NavPill — on-brand pill button/link
 * Navy blue text + thin navy border, animates to teal on hover.
 * Use as a button (onClick) or as a Link (to).
 */
export default function NavPill({ children, to, onClick, className = "", size = "sm" }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 cursor-pointer select-none " +
    "border-[#1A334D] text-[#1A334D] bg-white " +
    "hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] " +
    (size === "xs" ? "text-xs px-2.5 py-0.5 " : "text-xs px-3 py-1 ") +
    className;

  if (to) {
    return (
      <Link to={to} className={base}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={base} type="button">
      {children}
    </button>
  );
}