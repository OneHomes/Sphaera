import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seed data mirrors what was previously in lib/leadData.ts (mock), now
// written into the real database so the UI has realistic data to show
// immediately after connecting. Replace/delete this seed once real Gold
// data sync (Fabric -> Azure SQL) is wired up per the build spec.

const now = Date.now();
const minutesAgo = (n: number) => new Date(now - n * 60_000);
const hoursAgo = (n: number) => new Date(now - n * 60 * 60_000);
const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60_000);
const inHours = (n: number) => new Date(now + n * 60 * 60_000);
const inDays = (n: number) => new Date(now + n * 24 * 60 * 60_000);

async function main() {
  await prisma.leadTimelineEvent.deleteMany();
  await prisma.leadNote.deleteMany();
  await prisma.lead.deleteMany();

  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        name: "Evelyn Hayes",
        contact: "+44 7911 123456",
        source: "Meta Ads",
        market: "UK",
        projectInterest: "One Serene Vista — 2 Bed",
        stage: "Qualified",
        score: 88,
        engagement: "High",
        priority: "High",
        lastInteractionAt: minutesAgo(2),
        nextAction: "Call back",
        nextActionDueAt: inHours(3),
        assignment: "Assigned",
        prioritizationReason:
          "Responded within 5 min of last message; viewed 3 unit pages today",
      },
    }),
    prisma.lead.create({
      data: {
        name: "Theodore Vance",
        contact: "+44 7911 654321",
        source: "HubSpot — Landing Page",
        market: "UK",
        projectInterest: "Azure Bay — 1 Bed Suite",
        stage: "Meeting Booked",
        score: 82,
        engagement: "High",
        priority: "High",
        lastInteractionAt: minutesAgo(6),
        nextAction: "Prepare meeting brief",
        nextActionDueAt: inHours(5),
        assignment: "Assigned",
        prioritizationReason: "Meeting confirmed for today; high budget fit",
      },
    }),
    prisma.lead.create({
      data: {
        name: "Luna Wright",
        contact: "luna.wright@gmail.com",
        source: "Salesforce",
        market: "UAE",
        projectInterest: "Downtown Getaway — Studio",
        stage: "Contacted",
        score: 71,
        engagement: "Medium",
        priority: "Medium",
        lastInteractionAt: minutesAgo(11),
        nextAction: "Send follow-up email",
        nextActionDueAt: inDays(1),
        assignment: "Assigned",
        prioritizationReason: "Opened last 2 emails, no reply yet",
      },
    }),
    prisma.lead.create({
      data: {
        name: "Jasper Reed",
        contact: "+971 50 123 4567",
        source: "Meta Ads",
        market: "UAE",
        projectInterest: "Ocean Breeze Residences",
        stage: "New",
        score: 45,
        engagement: "Low",
        priority: "Medium",
        lastInteractionAt: minutesAgo(15),
        nextAction: "First contact call",
        nextActionDueAt: inHours(6),
        assignment: "Unassigned",
        prioritizationReason:
          "New lead — inside 60-minute speed-to-lead window",
      },
    }),
    prisma.lead.create({
      data: {
        name: "Scarlett Hayes",
        contact: "scarlett.h@outlook.com",
        source: "HubSpot — Chat",
        market: "UK",
        projectInterest: "Metro Luxe Downtown",
        stage: "Qualified",
        score: 64,
        engagement: "Medium",
        priority: "Medium",
        lastInteractionAt: minutesAgo(24),
        nextAction: "Share brochure",
        nextActionDueAt: inHours(7),
        assignment: "Assigned",
        prioritizationReason: "Asked about payment plans in last chat",
      },
    }),
    prisma.lead.create({
      data: {
        name: "Atticus Vance",
        contact: "+44 7911 987654",
        source: "Salesforce",
        market: "UK",
        projectInterest: "Worldwide Stays",
        stage: "Contacted",
        score: 58,
        engagement: "Medium",
        priority: "Low",
        lastInteractionAt: minutesAgo(37),
        nextAction: "Follow-up call",
        nextActionDueAt: inDays(1),
        assignment: "Assigned",
        prioritizationReason: "Moderate engagement, no urgency flagged",
      },
    }),
    prisma.lead.create({
      data: {
        name: "Hazel Wright",
        contact: "+971 50 765 4321",
        source: "Meta Ads",
        market: "UAE",
        projectInterest: "Summit View Launch",
        stage: "New",
        score: 39,
        engagement: "Low",
        priority: "Low",
        lastInteractionAt: hoursAgo(6),
        nextAction: "First contact call",
        nextActionDueAt: hoursAgo(1), // deliberately in the past -> renders as Overdue
        assignment: "Unassigned",
        prioritizationReason:
          "Missed 60-minute speed-to-lead window — needs immediate action",
      },
    }),
    prisma.lead.create({
      data: {
        name: "Milo Reed",
        contact: "milo.reed@gmail.com",
        source: "HubSpot — Landing Page",
        market: "UK",
        projectInterest: "Peak Retreat Project",
        stage: "Contacted",
        score: 52,
        engagement: "Medium",
        priority: "Medium",
        lastInteractionAt: hoursAgo(15),
        nextAction: "Re-engagement message",
        nextActionDueAt: inHours(4),
        assignment: "Assigned",
        prioritizationReason: "No response in 15 hours — risk of going cold",
      },
    }),
    prisma.lead.create({
      data: {
        name: "Violet Hayes",
        contact: "+44 7911 456789",
        source: "Salesforce",
        market: "UK",
        projectInterest: "Bright Star Flats",
        stage: "New",
        score: 28,
        engagement: "Low",
        priority: "Low",
        lastInteractionAt: daysAgo(5),
        nextAction: "Nurture / re-qualify",
        nextActionDueAt: inDays(3),
        assignment: "Unassigned",
        prioritizationReason:
          "Long inactivity — candidate for nurture track, not active outreach",
      },
    }),
  ]);

  // A few illustrative notes + timeline events on the first lead only,
  // so the Lead 360 profile has something real to show without seeding
  // exhaustive history for every lead.
  const [evelyn] = leads;

  await prisma.leadNote.create({
    data: {
      leadId: evelyn.id,
      author: "You",
      text: "Client interested in One Serene Vista — 2 Bed, asked about payment plan flexibility.",
    },
  });

  await prisma.leadTimelineEvent.createMany({
    data: [
      {
        leadId: evelyn.id,
        type: "stage_change",
        summary: "Lead created from Meta Ads",
        occurredAt: daysAgo(5),
      },
      {
        leadId: evelyn.id,
        type: "call",
        summary: "First contact call — connected, 4 min duration",
        occurredAt: daysAgo(4),
      },
      {
        leadId: evelyn.id,
        type: "email",
        summary: "Sent brochure for One Serene Vista — 2 Bed",
        occurredAt: daysAgo(3),
      },
      {
        leadId: evelyn.id,
        type: "stage_change",
        summary: "Stage moved to Qualified",
        occurredAt: daysAgo(2),
      },
      {
        leadId: evelyn.id,
        type: "meeting",
        summary: "Site viewing scheduled and confirmed",
        occurredAt: hoursAgo(20),
      },
    ],
  });

 console.log(`Seeded ${leads.length} leads.`);

  await prisma.opportunity.deleteMany();

  const [, theodore, luna, scarlett] = leads;

  await prisma.opportunity.createMany({
    data: [
      {
        leadName: evelyn.name,
        contact: evelyn.contact,
        value: 210_000,
        probability: 82,
        expectedCloseAt: inDays(20),
        projectInterest: evelyn.projectInterest,
        nextAction: "Call back today",
        stage: "Qualified",
        leadId: evelyn.id,
      },
      {
        leadName: theodore.name,
        contact: theodore.contact,
        value: 175_000,
        probability: 75,
        expectedCloseAt: inDays(18),
        projectInterest: theodore.projectInterest,
        nextAction: "Meeting prep",
        stage: "Meeting Booked",
        leadId: theodore.id,
      },
      {
        leadName: luna.name,
        contact: luna.contact,
        value: 130_000,
        probability: 55,
        expectedCloseAt: inDays(60),
        projectInterest: luna.projectInterest,
        nextAction: "Follow-up email",
        stage: "Contacted",
        leadId: luna.id,
      },
      {
        leadName: scarlett.name,
        contact: scarlett.contact,
        value: 156_000,
        probability: 60,
        expectedCloseAt: inDays(45),
        projectInterest: scarlett.projectInterest,
        nextAction: "Share brochure",
        stage: "Qualified",
        leadId: scarlett.id,
      },
      {
        leadName: "Marcus Webb",
        contact: "marcus.webb@gmail.com",
        value: 240_000,
        probability: 68,
        expectedCloseAt: inDays(25),
        projectInterest: "One Serene Vista — 3 Bed",
        nextAction: "Draft proposal",
        stage: "Opportunity",
      },
      {
        leadName: "Priya Anand",
        contact: "+971 50 222 3344",
        value: 310_000,
        probability: 88,
        expectedCloseAt: inDays(10),
        projectInterest: "Ocean Breeze Residences",
        nextAction: "Finalise payment plan",
        stage: "Negotiation",
      },
      {
        leadName: "Daniel Osei",
        contact: "daniel.osei@gmail.com",
        value: 98_000,
        probability: 40,
        expectedCloseAt: inDays(70),
        projectInterest: "Worldwide Stays",
        nextAction: "First contact call",
        stage: "New",
      },
      {
        leadName: "Aisha Karim",
        contact: "+971 50 555 6677",
        value: 185_000,
        probability: 92,
        expectedCloseAt: inDays(4),
        projectInterest: "Downtown Getaway — 2 Bed",
        nextAction: "Send contract",
        stage: "Negotiation",
      },
      {
        leadName: "Ben Foster",
        contact: "ben.foster@outlook.com",
        value: 145_000,
        probability: 100,
        expectedCloseAt: daysAgo(2),
        projectInterest: "Metro Luxe Downtown",
        nextAction: "Handover to collections",
        stage: "Closed Won",
      },
      {
        leadName: "Grace Lin",
        contact: "grace.lin@gmail.com",
        value: 120_000,
        probability: 0,
        expectedCloseAt: daysAgo(5),
        projectInterest: "Peak Retreat Project",
        nextAction: "Archive",
        stage: "Closed Lost",
        lossReason: "Chose a competitor",
      },
    ],
  });

  console.log("Seeded 10 opportunities.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });