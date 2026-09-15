import Link from "next/link";
import { Target, MapPinned, Handshake, FileText } from "lucide-react";
import type { Lead } from "@/lib/leadData";
import type { Qualification } from "@/lib/leadProfileData";
import { EngagementIndicator } from "@/components/leads/LeadBadges";

export type RealOpportunity = {
  value: number;
  probability: number;
  stage: string;
  expectedCloseAt: string | null;
};

export type RelatedDocument = {
  id: string;
  name: string;
  docType: string;
  uploadedByName: string;
};

function SidePanelCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Target;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-50">
        <Icon className="h-4 w-4 text-ink-300" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-300">{value}</span>
    </div>
  );
}

export function LeadSidePanel({
  lead,
  qualification,
  opportunity,
  relatedDocuments,
}: {
  lead: Lead;
  qualification: Qualification;
  opportunity: RealOpportunity | null;
  relatedDocuments: RelatedDocument[];
}) {
  return (
    <div className="space-y-4">
      <SidePanelCard title="Source & attribution" icon={MapPinned}>
        <Field label="Source" value={lead.source} />
        <Field label="Market" value={lead.market} />
        <div className="flex items-center justify-between py-1.5 text-xs">
          <span className="text-ink-500">Engagement</span>
          <EngagementIndicator level={lead.engagement} />
        </div>
      </SidePanelCard>

      <SidePanelCard title="Preferences & qualification" icon={Target}>
        <Field label="Budget range" value={qualification.budgetRange} />
        <Field label="Bedrooms" value={qualification.bedroomPreference} />
        <Field label="Move-in" value={qualification.moveInTimeline} />
        <Field label="Financing" value={qualification.financing} />
        <p className="mt-2 text-[10px] text-ink-500">
          Heuristic estimate from lead score and project interest — not a
          confirmed client answer.
        </p>
      </SidePanelCard>

      <SidePanelCard title="Opportunity & negotiation" icon={Handshake}>
        {opportunity ? (
          <>
            <Field label="Value" value={`$${opportunity.value.toLocaleString()}`} />
            <Field label="Probability" value={`${opportunity.probability}%`} />
            <Field label="Stage" value={opportunity.stage} />
            <Field
              label="Expected close"
              value={
                opportunity.expectedCloseAt
                  ? new Date(opportunity.expectedCloseAt).toLocaleDateString()
                  : "Not set"
              }
            />
          </>
        ) : (
          <p className="py-2 text-xs text-ink-500">
            No opportunity created yet for this lead.
          </p>
        )}
        <Field label="Interested in" value={lead.projectInterest} />
      </SidePanelCard>

      <SidePanelCard title="Reference documents" icon={FileText}>
        {relatedDocuments.length > 0 ? (
          <div className="space-y-1.5">
            {relatedDocuments.map((doc) => (
              <Link
                key={doc.id}
                href="/documents"
                className="flex items-center justify-between rounded-lg px-1.5 py-1 text-xs hover:bg-base-800"
              >
                <span className="truncate text-ink-300">{doc.name}</span>
                <span className="shrink-0 text-[10px] text-ink-500">{doc.docType}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-2 text-xs text-ink-500">
            No brochures, price lists, or payment plans uploaded for{" "}
            {lead.projectInterest} yet.
          </p>
        )}
      </SidePanelCard>
    </div>
  );
}
