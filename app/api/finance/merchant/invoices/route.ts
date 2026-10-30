import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadDocumentBlob } from "@/lib/blobStorage";
import {
  createMerchantInvoice,
  validateInvoiceFileSignature,
  extractInvoiceFieldSuggestions,
} from "@/lib/finance/merchantReconcileData";
import { logAudit } from "@/lib/auditLog";
import { paymentsOutsideScope } from "@/lib/finance/departmentAccess";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Invoice evidence already linked to one payment (the payment detail form's "Invoice evidence").
export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const transactionId = new URL(request.url).searchParams.get("transactionId") ?? "";
      if (!transactionId) return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
      const outOfScope = await paymentsOutsideScope(authUser.id, [transactionId]);
      if (outOfScope) return NextResponse.json({ error: outOfScope }, { status: 403 });
      const links = await prisma.financeMerchantInvoiceLink.findMany({
        where: { transactionId },
        select: { invoice: { select: { id: true, supplier: true, documentId: true, amount: true, currency: true, invoiceDate: true } } },
      });
      const docIds = links.map((l) => l.invoice.documentId).filter((d): d is string => !!d);
      const docs = docIds.length
        ? await prisma.document.findMany({ where: { id: { in: docIds } }, select: { id: true, name: true } })
        : [];
      const docName = new Map(docs.map((d) => [d.id, d.name]));
      return NextResponse.json({
        invoices: links.map(({ invoice: i }) => ({ ...i, documentName: i.documentId ? docName.get(i.documentId) ?? null : null })),
      });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

// Invoice evidence upload: accepts multipart/form-data (the uploaded
// file plus the invoice metadata fields), uploads the file bytes via the
// app-wide blob storage helper, creates a Document row for it, then
// creates the FinanceMerchantInvoice record pointing at that Document.
// extractedText is left null here — actual text extraction (OCR/PDF
// parsing) is a later-stage concern per merchantReconcileData.ts's own
// doc comments; extractInvoiceFieldSuggestions is exposed separately via
// a client call once extractedText is available.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const formData = await request.formData();
      const file = formData.get("file");
      const supplier = String(formData.get("supplier") ?? "");
      const amount = Number(formData.get("amount"));
      const currency = String(formData.get("currency") ?? "");
      const invoiceDateIso = formData.get("invoiceDate") ? String(formData.get("invoiceDate")) : undefined;

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const signatureCheck = validateInvoiceFileSignature(buffer, file.name);
      if (!signatureCheck.ok) {
        return NextResponse.json({ error: signatureCheck.error }, { status: 400 });
      }

      const blobName = `${randomUUID()}-${file.name}`;
      try {
        await uploadDocumentBlob(blobName, buffer, file.type || "application/octet-stream");
      } catch (err) {
        console.error("Blob upload failed:", err);
        return NextResponse.json(
          { error: "Failed to upload file to storage. Check Azure Storage configuration." },
          { status: 502 }
        );
      }

      const document = await prisma.document.create({
        data: {
          name: file.name,
          blobName,
          contentType: file.type || "application/octet-stream",
          sizeBytes: buffer.byteLength,
          docType: "Finance Merchant Invoice",
          relatedTo: supplier || null,
          uploadedById: authUser.id,
        },
      });

      // Best-effort field suggestions only run when the caller already has
      // extracted text to offer (e.g. a prior OCR pass) — this route
      // itself does not perform text extraction.
      const extractedTextField = formData.get("extractedText");
      const extractedText = typeof extractedTextField === "string" ? extractedTextField : null;
      if (extractedText) {
        // Surface suggestions for the client via a side-channel is out of
        // scope for this creation call's response shape; clients needing
        // suggestions should call extractInvoiceFieldSuggestions through a
        // dedicated flow. Computed here only to validate it doesn't throw.
        await extractInvoiceFieldSuggestions(extractedText).catch(() => null);
      }

      const result = await createMerchantInvoice({
        organizationId: authUser.organizationId,
        supplier,
        amount,
        currency,
        invoiceDateIso,
        documentId: document.id,
        extractedText,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_merchant_invoice_created",
        targetId: result.id,
        details: `Uploaded merchant invoice for "${supplier}"`,
      });

      return NextResponse.json({ ok: true, id: result.id, documentId: document.id }, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
