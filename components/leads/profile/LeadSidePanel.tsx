import { Target, MapPinned, Handshake } from "lucide-react";
import type { Lead } from "@/lib/leadData";
import type { Qualification, OpportunityDetail } from "@/lib/leadProfileData";
import { EngagementIndicator } from "@/components/leads/LeadBadges";

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
}: {
  lead: Lead;
  qualification: Qualification;
  opportunity: OpportunityDetail;
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
      </SidePanelCard>

      <SidePanelCard title="Opportunity & negotiation" icon={Handshake}>
        <Field
          label="Estimated value"
          value={`$${opportunity.value.toLocaleString()}`}
        />
        <Field label="Probability" value={`${opportunity.probability}%`} />
        <Field
          label="Expected close"
          value={opportunity.expectedCloseDate}
        />
        <Field label="Interested in" value={lead.projectInterest} />
      </SidePanelCard>
    </div>
  );
}
