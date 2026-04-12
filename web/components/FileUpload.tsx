"use client";

import { useCallback, useState } from "react";

interface Props {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPTED = [".docx", ".txt", ".md"];

export default function FileUpload({ onFilesSelected, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File[]>([]);

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      const valid = Array.from(incoming).filter((f) =>
        ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext))
      );
      const merged = [...selected, ...valid].filter(
        (f, i, arr) => arr.findIndex((x) => x.name === f.name) === i
      );
      setSelected(merged);
      onFilesSelected(merged);
    },
    [selected, onFilesSelected]
  );

  const removeFile = (name: string) => {
    const next = selected.filter((f) => f.name !== name);
    setSelected(next);
    onFilesSelected(next);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors
          ${dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"}
          ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <input
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
          disabled={disabled}
        />
        <div className="text-center px-6">
          <svg className="mx-auto h-10 w-10 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 16v-8m0 0-3 3m3-3 3 3M6.5 19h11a2 2 0 002-2V9.5L14 4H6.5A1.5 1.5 0 005 5.5v11A2 2 0 006.5 19z" />
          </svg>
          <p className="text-sm font-medium text-slate-600">Drop files here or <span className="text-indigo-600">browse</span></p>
          <p className="text-xs text-slate-400 mt-1">Supported: .docx · .txt · .md</p>
        </div>
      </label>

      {/* File list */}
      {selected.length > 0 && (
        <ul className="space-y-2">
          {selected.map((f) => (
            <li key={f.name}
              className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon name={f.name} />
                <span className="truncate text-slate-700 font-medium">{f.name}</span>
                <span className="text-slate-400 shrink-0">{formatSize(f.size)}</span>
              </div>
              {!disabled && (
                <button onClick={() => removeFile(f.name)}
                  className="ml-3 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  const color = ext === "docx" ? "text-blue-500" : "text-slate-500";
  return (
    <svg className={`h-4 w-4 ${color} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
