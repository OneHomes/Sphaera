"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Download, Plus, Trash2 } from "lucide-react";
import type { SphaeraDocument, DocType } from "@/lib/documentsData";
import { UploadDocumentModal } from "./UploadDocumentModal";

const typeStyles: Record<DocType, string> = {
  Brochure: "bg-status-active/15 text-status-active",
  "Price List": "bg-sky-500/15 text-sky-400",
  "Payment Plan": "bg-violet-500/15 text-violet-400",
  Contract: "bg-status-alert/15 text-status-alert",
  Proposal: "bg-tier-gold/15 text-tier-gold",
};

export function DocumentsPage({
  initialDocuments,
  documentOwnerIds,
  currentUserId,
  canManageAll,
}: {
  initialDocuments: SphaeraDocument[];
  documentOwnerIds: Record<string, string>;
  currentUserId: string;
  canManageAll: boolean;
}) {
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this document? This can't be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete document");
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Documents</h1>
          <p className="text-sm text-ink-500">
            {initialDocuments.length} documents
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-semibold text-base-950 hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Upload
        </button>
      </div>

      <div className="max-w-3xl space-y-2">
        {initialDocuments.map((doc) => {
          const canDelete = canManageAll || documentOwnerIds[doc.id] === currentUserId;
          return (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-base-700 bg-base-900 p-3"
            >
              <FileText className="h-5 w-5 shrink-0 text-ink-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink-50">{doc.name}</p>
                <p className="text-xs text-ink-500">
                  {doc.relatedTo} · {doc.uploadedBy} · {doc.uploadedDate} · {doc.sizeLabel}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${typeStyles[doc.type]}`}
              >
                {doc.type}
              </span>
              <a
                href={`/api/documents/${doc.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-ink-500 hover:text-ink-300"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
              {canDelete && (
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="shrink-0 text-ink-500 hover:text-status-inactive disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}

        {initialDocuments.length === 0 && (
          <div className="mt-8 text-center text-sm text-ink-500">
            No documents yet. Upload a brochure, price list, or contract to get started.
          </div>
        )}
      </div>

      {showUpload && (
        <UploadDocumentModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => router.refresh()}
        />
      )}
    </div>
  );
}
