import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ToastType = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  timeout?: number; // ms
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, timeout?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function ToastContainer({ items, onDismiss }: { items: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed z-50 bottom-4 right-4 space-y-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={classNames(
            "rounded shadow px-4 py-3 text-sm border",
            t.type === "success" && "bg-green-50 text-green-800 border-green-200",
            t.type === "error" && "bg-red-50 text-red-800 border-red-200",
            t.type === "warning" && "bg-amber-50 text-amber-800 border-amber-200",
            t.type === "info" && "bg-blue-50 text-blue-800 border-blue-200",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">{t.message}</div>
            <button className="opacity-70 hover:opacity-100" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info", timeout = 3000) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, type, message, timeout };
    setItems((prev) => [...prev, toast]);
    if (timeout && timeout > 0) {
      setTimeout(() => dismiss(id), timeout);
    }
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(() => ({ showToast, dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
