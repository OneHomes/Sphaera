// Phase 1 Sales Scope — "Janus company knowledge": Janus needs to
// actually read a document's content (brochures, price lists, payment
// plans) to ground answers in it, not just know a file exists. This
// extracts plain text at upload time so it only has to happen once.
//
// Best-effort: unsupported formats (images, .docx, .pptx) return null
// rather than throwing — the document still uploads and is browsable,
// it just won't be usable as Janus grounding material yet.
const TEXT_MIME_TYPES = new Set(["text/plain", "text/csv", "text/markdown"]);

// pdf-parse is loaded only when a PDF is actually parsed, never when a route
// that imports this file loads. On Azure, loading it at the top of the
// module made every importing route 500 before it ran (including
// GET /api/documents, which never parses anything), so the Documents page
// failed whenever PDF parsing did. Now a failure is confined to that PDF.
//
// pdf.js parses in a worker that pdf-parse normally loads from a file beside
// itself; webpack bundles pdf-parse without that file ("Setting up fake
// worker failed"). getData() is the worker embedded as a data: URL, which
// needs no file on disk (pdf-parse's documented Next.js/serverless setup).
let pdfParse: Promise<typeof import("pdf-parse")> | null = null;
function loadPdfParse() {
  pdfParse ??= (async () => {
    const mod = await import("pdf-parse");
    const { getData } = await import("pdf-parse/worker");
    mod.PDFParse.setWorker(getData());
    return mod;
  })().catch((err) => {
    pdfParse = null; // try loading again on the next PDF
    throw err;
  });
  return pdfParse;
}

export async function extractDocumentText(
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  try {
    if (contentType === "application/pdf") {
      const { PDFParse } = await loadPdfParse();
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
