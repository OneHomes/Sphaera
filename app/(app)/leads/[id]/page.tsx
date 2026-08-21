import { notFound } from "next/navigation";
import { leads } from "@/lib/leadData";
import { LeadProfile } from "@/components/leads/profile/LeadProfile";

export default function LeadProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const lead = leads.find((l) => l.id === params.id);

  if (!lead) {
    notFound();
  }

  return <LeadProfile lead={lead} />;
}
