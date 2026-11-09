import { NextResponse } from "next/server";
import { extractDocumentText } from "@/lib/documentTextExtraction";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Files attached to a Janus question (Command Center paperclip / drag and
// drop). Returns the file's text so the client can send it along with the
// question; nothing is stored. Janus is text-only, so only formats we can
// read as text are accepted.
const MAX_BYTES = 10 * 1024 * 1024;
// Roughly 5k tokens per file: enough for a price list or a payment plan
// without one attachment crowding out the rest of Janus's context.
const MAX_ATTACHMENT_CHARS = 20_000;

const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  json: "text/plain",
};

export async function POST(request: Request) {
  try {
    return await withTenant(async () => {
      const form = await request.formData().catch(() => null);
      const file = form?.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file received" }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Files up to 10 MB can be attached" }, { status: 413 });
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const contentType = TYPE_BY_EXTENSION[ext];
      if (!contentType) {
        return NextResponse.json(
          { error: "Janus can read PDF, TXT, CSV, MD and JSON files" },
          { status: 415 }
        );
      }

      const text = await extractDocumentText(Buffer.from(await file.arrayBuffer()), contentType);
      if (!text) {
        // e.g. a scanned PDF with no text layer
        return NextResponse.json({ error: "No readable text found in this file" }, { status: 422 });
      }

      const truncated = text.length > MAX_ATTACHMENT_CHARS;
      return NextResponse.json({
        name: file.name,
        text: truncated ? text.slice(0, MAX_ATTACHMENT_CHARS) : text,
        truncated,
      });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
