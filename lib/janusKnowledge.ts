import { prisma } from "./prisma";

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "what", "which", "who", "how", "for", "of",
  "to", "in", "on", "and", "or", "do", "does", "can", "i", "me", "my",
]);

function keywordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export type DocumentMatch = {
  id: string;
  name: string;
  docType: string;
  relatedTo: string | null;
  excerpt: string;
};

/**
 * Phase 1 Sales Scope — "Janus company knowledge": retrieves the most
 * relevant approved documents for a question, with an excerpt of actual
 * content so Janus can ground its answer and cite the source document
 * by name rather than inventing an answer. Simple keyword-overlap
 * scoring rather than a vector index — proportionate to a pilot's
 * document volume, and transparent/debuggable if a match looks wrong.
 */
export async function getRelevantDocuments(
  question: string,
  limit = 3
): Promise<DocumentMatch[]> {
  const questionKeywords = new Set(keywordsOf(question));
  if (questionKeywords.size === 0) return [];

  const documents = await prisma.document.findMany({
    where: { extractedText: { not: null } },
    select: { id: true, name: true, docType: true, relatedTo: true, extractedText: true },
  });

  const scored = documents
    .map((doc) => {
      const haystack = keywordsOf(
        `${doc.name} ${doc.docType} ${doc.relatedTo ?? ""} ${doc.extractedText ?? ""}`
      );
      const haystackSet = new Set(haystack);
      let score = 0;
      for (const kw of questionKeywords) {
        if (haystackSet.has(kw)) score += 1;
      }
      return { doc, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ doc }) => ({
    id: doc.id,
    name: doc.name,
    docType: doc.docType,
    relatedTo: doc.relatedTo,
    // Truncated — this is grounding context for the model, not the full
    // document; keeps token usage proportionate even for a long PDF.
    excerpt: (doc.extractedText ?? "").slice(0, 2000),
  }));
}

export function formatDocumentGroundingContext(matches: DocumentMatch[]): string {
  if (matches.length === 0) {
    return "No approved company documents matched this question.";
  }
  return matches
    .map(
      (m) =>
        `Document: "${m.name}" (${m.docType}${m.relatedTo ? `, related to ${m.relatedTo}` : ""})\n${m.excerpt}`
    )
    .join("\n\n---\n\n");
}
