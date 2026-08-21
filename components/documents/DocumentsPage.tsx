import { FileText, Download } from "lucide-react";
import { documents, type SphaeraDocument } from "@/lib/documentsData";

const typeStyles: Record<SphaeraDocument["type"], string> = {
  Brochure: "bg-status-active/15 text-status-active",
  "Price List": "bg-sky-500/15 text-sky-400",
  "Payment Plan": "bg-violet-500/15 text-violet-400",
  Contract: "bg-status-alert/15 text-status-alert",
  Proposal: "bg-tier-gold/15 text-tier-gold",
};

export function DocumentsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-50">Documents</h1>
      <p className="mb-5 text-sm text-ink-500">
        {documents.length} documents
      </p>

      <div className="max-w-3xl space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 rounded-lg border border-base-700 bg-base-900 p-3"
          >
            <FileText className="h-5 w-5 shrink-0 text-ink-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink-50">{doc.name}</p>
              <p className="text-xs text-ink-500">
                {doc.relatedTo} · {doc.uploadedDate} · {doc.sizeLabel}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${typeStyles[doc.type]}`}
            >
              {doc.type}
            </span>
            <button className="shrink-0 text-ink-500 hover:text-ink-300">
              <Download className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
