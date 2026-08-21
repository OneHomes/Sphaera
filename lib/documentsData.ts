// Placeholder data only. Real version reads from the Document Service
// (PRD PF08) once file storage/permissions are wired up.

export type SphaeraDocument = {
  id: string;
  name: string;
  type: "Brochure" | "Price List" | "Payment Plan" | "Contract" | "Proposal";
  relatedTo: string;
  uploadedDate: string;
  sizeLabel: string;
};

export const documents: SphaeraDocument[] = [
  { id: "d1", name: "One Serene Vista — Brochure.pdf", type: "Brochure", relatedTo: "One Serene Vista", uploadedDate: "2 weeks ago", sizeLabel: "4.2 MB" },
  { id: "d2", name: "Azure Bay — Price List Q1.xlsx", type: "Price List", relatedTo: "Azure Bay", uploadedDate: "1 week ago", sizeLabel: "180 KB" },
  { id: "d3", name: "Priya Anand — Payment Plan.pdf", type: "Payment Plan", relatedTo: "Priya Anand", uploadedDate: "3 days ago", sizeLabel: "220 KB" },
  { id: "d4", name: "Ben Foster — Signed Contract.pdf", type: "Contract", relatedTo: "Ben Foster", uploadedDate: "1 day ago", sizeLabel: "1.1 MB" },
  { id: "d5", name: "Ocean Breeze — Investment Proposal.pptx", type: "Proposal", relatedTo: "Ocean Breeze Residences", uploadedDate: "5 days ago", sizeLabel: "6.8 MB" },
  { id: "d6", name: "Metro Luxe — Brochure.pdf", type: "Brochure", relatedTo: "Metro Luxe Downtown", uploadedDate: "3 weeks ago", sizeLabel: "3.9 MB" },
];
