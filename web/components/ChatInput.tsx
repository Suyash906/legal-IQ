"use client";

import { useRef, useState, KeyboardEvent } from "react";

interface Props {
  onSend: (text: string, files: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ACCEPTED = [".docx", ".txt", ".md"];

export default function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter((f) =>
      ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    setFiles((prev) =>
      [...prev, ...valid].filter((f, i, arr) => arr.findIndex((x) => x.name === f.name) === i)
    );
  };

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed && !files.length) return;
    onSend(trimmed || (files.length ? `Please analyse the attached document${files.length > 1 ? "s" : ""}.` : ""), files);
    setText("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => textRef.current?.focus(), 0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) send();
    }
  };

  // Auto-grow textarea
  const onInput = () => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const canSend = (text.trim().length > 0 || files.length > 0) && !disabled;

  return (
    <div className="border-t border-slate-200 bg-white px-4 pt-3 pb-4">
      {/* Attached files */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map((f) => (
            <div key={f.name}
              className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
              <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="max-w-[160px] truncate font-medium">{f.name}</span>
              <button onClick={() => removeFile(f.name)}
                className="ml-0.5 text-indigo-400 hover:text-indigo-700 transition-colors">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Attach files (.docx, .txt, .md)"
          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 transition-colors">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input ref={fileInputRef} type="file" multiple accept={ACCEPTED.join(",")}
          className="hidden" onChange={(e) => addFiles(e.target.files)} />

        {/* Text area */}
        <textarea
          ref={textRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onInput={onInput}
          disabled={disabled}
          placeholder={placeholder ?? "Ask a compliance question or attach documents…"}
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 disabled:opacity-50 leading-relaxed"
          style={{ minHeight: "38px", maxHeight: "160px" }}
        />

        {/* Send button */}
        <button
          onClick={send}
          disabled={!canSend}
          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400 text-center">
        Enter to send · Shift+Enter for new line · attach .docx / .txt / .md
      </p>
    </div>
  );
}
