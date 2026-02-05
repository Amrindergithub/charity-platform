import { useEffect, useRef, useCallback } from 'react';

export default function Modal({ isOpen, title, message, confirmText = "Confirm", cancelText = "Cancel", onConfirm, onCancel, variant = "primary", children }) {
  const modalRef = useRef(null);
  const firstFocusRef = useRef(null);

  // Escape key handler
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }
    // Focus trap — Tab cycles within modal
    if (e.key === 'Tab' && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onCancel]);

  // Focus first element on open
  useEffect(() => {
    if (isOpen && firstFocusRef.current) {
      firstFocusRef.current.focus();
    }
  }, [isOpen]);

  // Add/remove keydown listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const isDanger = variant === "danger";

  const confirmButtonStyle = {
    padding: "10px 24px",
    borderRadius: "var(--radius, 12px)",
    border: "none",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: "var(--font-body, 'Inter', sans-serif)",
    transition: "var(--transition)",
    background: isDanger ? "var(--color-error, #FFB4AB)" : "#FF5C00",
    color: isDanger ? "#1C1B1B" : "#fff",
  };

  const cancelButtonStyle = {
    padding: "10px 24px",
    borderRadius: "var(--radius, 12px)",
    border: "1px solid rgba(91, 65, 55, 0.2)",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: "var(--font-body, 'Inter', sans-serif)",
    transition: "var(--transition)",
    background: "transparent",
    color: "var(--color-text, #E5E2E1)",
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h3 className="modal-title" id="modal-title">{title}</h3>
        {message && <p className="modal-message">{message}</p>}
        {children}
        <div className="modal-actions">
          <button style={cancelButtonStyle} onClick={onCancel} ref={firstFocusRef}>{cancelText}</button>
          <button style={confirmButtonStyle} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
