import { PDFParse } from "pdf-parse";

// Phase 1 Sales Scope — "Janus company knowledge": Janus needs to
// actually read a document's content (brochures, price lists, payment
// plans) to ground answers in it, not just know a file exists. This
// extracts plain text at upload time so it only has to happen once.
//
// Best-effort: unsupported formats (images, .docx, .pptx) return null
// rather than throwing — the document still uploads and is browsable,
// it just won't be usable as Janus grounding material yet.
const TEXT_MIME_TYPES = new Set(["text/plain", "text/csv", "text/markdown"]);

export async function extractDocumentText(
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  try {
    if (contentType === "application/pdf") {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      // pdf-parse appends "-- N of M --" page-separator markers — noise
      // for Janus's grounding context, not real document content.
      const cleaned = (result.text ?? "").replace(/--\s*\d+\s+of\s+\d+\s*--/g, "").trim();
      return cleaned || null;
    }
    if (TEXT_MIME_TYPES.has(contentType)) {
      return buffer.toString("utf-8").trim() || null;
    }
    return null;
  } catch (err) {
    console.error("Document text extraction failed:", err);
    return null;
  }
}
