import React from "react";
import { Link } from "react-router-dom";

/**
 * NavPill — on-brand pill button/link
 * Navy blue text + thin navy border, animates to teal on hover.
 * Use as a button (onClick) or as a Link (to).
 */
export default function NavPill({ children, to, onClick, className = "", size = "sm" }) {
  const base =
    `ui-pill cursor-pointer select-none ${size === "xs" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"} ${className}`;

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