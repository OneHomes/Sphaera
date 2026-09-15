import Link from "next/link";
import { Phone } from "lucide-react";
import type { Lead } from "@/lib/leadData";
import { StageBadge, ScoreBadge } from "@/components/leads/LeadBadges";

export function CallsHub({ leads }: { leads: Lead[] }) {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-50">Calls</h1>
      <p className="mb-5 text-sm text-ink-500">
        Your open leads, highest score first — start a call from any row.
      </p>

      <div className="max-w-3xl space-y-2">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className="flex items-center gap-3 rounded-lg border border-base-700 bg-base-900 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-ink-50">{lead.name}</p>
                <StageBadge stage={lead.stage} />
              </div>
              <p className="mt-0.5 text-xs text-ink-500">
                {lead.contact} · {lead.projectInterest}
              </p>
            </div>
            <ScoreBadge score={lead.score} />
            <Link
              href={`/calls/${lead.id}`}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-semibold text-base-950 hover:bg-white"
            >
              <Phone className="h-3.5 w-3.5" />
              Start call
            </Link>
          </div>
        ))}

        {leads.length === 0 && (
          <div className="mt-12 text-center text-sm text-ink-500">
            No open leads assigned to you right now.
          </div>
        )}
      </div>
    </div>
  );
}
