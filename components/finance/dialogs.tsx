"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

// In-app replacements for the browser's window.confirm / alert / prompt (One Homes request: the
// browser's own pop-ups appear at the top of the window and look out of place). Each call mounts a
// centred dialog, waits for the answer and removes itself, so call sites only change from
// `window.confirm(msg)` to `await confirmDialog(msg)`.

type DialogKind = "confirm" | "alert" | "prompt";

type DialogOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for removing / undoing / overwriting. */
  danger?: boolean;
  defaultValue?: string;
  placeholder?: string;
};

function Dialog({
  kind,
  message,
  options,
  onDone,
}: {
  kind: DialogKind;
  message: string;
  options: DialogOptions;
  onDone: (result: boolean | string | null) => void;
}) {
  const [value, setValue] = useState(options.defaultValue ?? "");
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const okRef = useRef<HTMLButtonElement | null>(null);

  const cancel = () => onDone(kind === "prompt" ? null : false);
  const ok = () => onDone(kind === "prompt" ? value : true);

  useEffect(() => {
    setVisible(true);
    (kind === "prompt" ? inputRef.current : okRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (kind === "alert") ok();
        else cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = options.title ?? (kind === "alert" ? "Notice" : kind === "prompt" ? "Enter a value" : "Please confirm");
  const okLabel = options.confirmLabel ?? (kind === "alert" ? "OK" : kind === "prompt" ? "Save" : "Confirm");
  const okClass = options.danger
    ? "bg-status-inactive text-white hover:opacity-90"
    : "bg-ink-50 text-base-950 hover:opacity-90";

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px] transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && kind !== "alert") cancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-dialog-title"
        className={`w-full max-w-md rounded-2xl border border-base-700 bg-base-900 p-5 shadow-2xl transition-transform duration-150 ${visible ? "scale-100" : "scale-95"}`}
      >
        <h2 id="finance-dialog-title" className="text-sm font-semibold text-ink-50">
          {title}
        </h2>
        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-300">{message}</p>
        {kind === "prompt" && (
          <input
            ref={inputRef}
            value={value}
            placeholder={options.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ok();
            }}
            className="mt-3 w-full rounded-lg border border-base-700 bg-base-800 px-2.5 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500 focus:border-base-600"
          />
        )}
        <div className="mt-5 flex justify-end gap-2">
          {kind !== "alert" && (
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
            >
              {options.cancelLabel ?? "Cancel"}
            </button>
          )}
          <button
            ref={okRef}
            type="button"
            onClick={ok}
            disabled={kind === "prompt" && !value.trim()}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${okClass}`}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function open(kind: DialogKind, message: string, options: DialogOptions = {}): Promise<boolean | string | null> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (result: boolean | string | null) => {
      root.unmount();
      host.remove();
      resolve(result);
    };
    root.render(<Dialog kind={kind} message={message} options={options} onDone={done} />);
  });
}

/** In-app window.confirm: resolves true on Confirm, false on Cancel / Escape / click outside. */
export function confirmDialog(message: string, options?: DialogOptions): Promise<boolean> {
  return open("confirm", message, options) as Promise<boolean>;
}

/** In-app window.alert. */
export async function alertDialog(message: string, options?: DialogOptions): Promise<void> {
  await open("alert", message, options);
}

/** In-app window.prompt: resolves the entered text, or null when cancelled. */
export function promptDialog(message: string, options?: DialogOptions): Promise<string | null> {
  return open("prompt", message, options) as Promise<string | null>;
}
