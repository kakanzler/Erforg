"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Centered overlay dialog. Closes on the ✕ button or Esc — but NOT on backdrop
 * click, so a long draft isn't lost by an accidental click outside.
 */
export function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-panel" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
