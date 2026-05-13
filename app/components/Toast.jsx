"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

const ToastCtx = createContext(null);

const ICONS = {
  success: "✓",
  danger: "✕",
  warning: "!",
  info: "i",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (msg, opts = {}) => {
      const id = Date.now() + Math.random();
      const variant = opts.variant || "info";
      const delay = opts.delay ?? 3500;
      setToasts((t) => [...t.slice(-3), { id, msg, variant, delay }]);
      setTimeout(() => remove(id), delay);
    },
    [remove]
  );

  const api = {
    push,
    success: (m, o) => push(m, { ...o, variant: "success" }),
    error: (m, o) => push(m, { ...o, variant: "danger", delay: o?.delay ?? 5000 }),
    warning: (m, o) => push(m, { ...o, variant: "warning" }),
    info: (m, o) => push(m, { ...o, variant: "info" }),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="md-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`md-toast ${t.variant}`}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, flexShrink: 0,
            }}>{ICONS[t.variant]}</span>
            <div style={{ flex: 1 }}>{t.msg}</div>
            <button className="md-toast-close" onClick={() => remove(t.id)} aria-label="Close">×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    return {
      push: (m) => console.log("toast:", m),
      success: (m) => console.log("toast(ok):", m),
      error: (m) => console.error("toast(err):", m),
      warning: (m) => console.warn("toast(warn):", m),
      info: (m) => console.info("toast:", m),
    };
  }
  return ctx;
}
