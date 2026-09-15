"use client";

import { useState } from "react";
import { X, UploadCloud } from "lucide-react";
import { DOC_TYPES, type DocType } from "@/lib/documentsData";

export function UploadDocumentModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>("Brochure");
  const [relatedTo, setRelatedTo] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", docType);
      if (relatedTo.trim()) formData.append("relatedTo", relatedTo.trim());

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to upload document");
      }

      onUploaded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">Upload document</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-base-700 bg-base-800 px-3 py-6 text-center text-xs text-ink-500 hover:border-base-600">
            <UploadCloud className="h-5 w-5" />
            {file ? file.name : "Click to choose a file"}
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>

          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocType)}
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300 outline-none"
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <input
            value={relatedTo}
            onChange={(e) => setRelatedTo(e.target.value)}
            placeholder="Related to (optional) — e.g. project or client name"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />

          {error && <p className="text-xs text-status-inactive">{error}</p>}

          <button
            type="submit"
            disabled={isUploading}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink-50 py-2 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
          >
            {isUploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      </div>
    </div>
  );
}
