// Placeholder data only. Every table/chart here reads from a real source
// once the Gold-layer entities (Lead, Opportunity, Activity) are validated:
//   - mostInDemand      -> Product/Unit read model + Opportunity interest count
//   - monthlySales      -> Opportunity (closed won) aggregated by month
//   - pending           -> Task / Opportunity next-action queue
//   - productivityByHour-> Activity events bucketed by hour, per PRD AE05
//   - agentActivityIndex-> User + Productivity Index (PRD Section 5.3 formula)

export type PriorityLevel = "High" | "Medium" | "Low";

export type MostInDemandRow = {
  unitNo: string;
  type: string;
  interested: number;
  value: number;
};

export const mostInDemand: MostInDemandRow[] = [
  { unitNo: "401-OSR", type: "1 Bed Suite", interested: 44, value: 77_000.24 },
  { unitNo: "707-AR", type: "1 Bed Suite", interested: 32, value: 72_000.41 },
  { unitNo: "1124-AP", type: "2 Bedroom", interested: 22, value: 140_000.15 },
  { unitNo: "1017-OSR", type: "2 Bedroom", interested: 21, value: 150_000.12 },
  { unitNo: "DTH-101-OSR", type: "4 Bed Townhouse", interested: 16, value: 220_000.24 },
];

export type PendingRow = {
  name: string;
  value: number;
  type: string;
  priority: PriorityLevel;
  dueLabel: string;
};

export const pendingItems: PendingRow[] = [
  { name: "John Doe", value: 77_000.24, type: "Down Payment", priority: "High", dueLabel: "Today" },
  { name: "Abraham", value: 72_000.41, type: "Down Payment", priority: "High", dueLabel: "Today" },
  { name: "John Doe", value: 140_000.15, type: "Installment", priority: "Medium", dueLabel: "3 days away" },
  { name: "Abraham", value: 150_000.12, type: "Follow Up", priority: "Medium", dueLabel: "7 days away" },
  { name: "Abraham", value: 220_000.24, type: "Down Payment", priority: "Low", dueLabel: "15 days away" },
];

export type MonthlySalesPoint = {
  month: string;
  closedValue: number;
};

export const monthlySales: MonthlySalesPoint[] = [
  { month: "Jan", closedValue: 900_000 },
  { month: "Feb", closedValue: 1_500_000 },
  { month: "Mar", closedValue: 2_000_000 },
  { month: "Apr", closedValue: 1_650_000 },
  { month: "May", closedValue: 2_100_000 },
  { month: "Jun", closedValue: 1_500_000 },
  { month: "Jul", closedValue: 2_150_000 },
  { month: "Aug", closedValue: 1_750_000 },
  { month: "Sep", closedValue: 1_800_000 },
  { month: "Oct", closedValue: 1_950_000 },
  { month: "Nov", closedValue: 2_250_000 },
  { month: "Dec", closedValue: 2_500_000 },
];

export type ProductivityPoint = {
  hour: string;
  score: number;
};

export const productivityByHour: ProductivityPoint[] = [
  "12 AM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM",
  "7 PM", "8 PM", "9 PM", "10 PM", "11 PM", "12 AM",
].map((hour, i) => ({
  hour,
  score: [10, 15, 22, 45, 60, 55, 40, 35, 50, 65, 30, 20, 10][i] ?? 0,
}));

export type AgentStatus = "Optimal Activity" | "Moderate Activity" | "Minimal Activity";

export type AgentActivityRow = {
  name: string;
  extension: string;
  email: string;
  status: AgentStatus;
  productivityScore: number;
};

export const agentActivityIndex: AgentActivityRow[] = [
  { name: "John Doe", extension: "+44090078601", email: "johndoe@onehomes.com", status: "Optimal Activity", productivityScore: 63 },
  { name: "Abraham", extension: "+44090078601", email: "abraham@onehomes.com", status: "Optimal Activity", productivityScore: 61 },
  { name: "John Doe", extension: "+44090078601", email: "johndoe@onehomes.com", status: "Optimal Activity", productivityScore: 60 },
  { name: "Abraham", extension: "+44090078601", email: "abraham@onehomes.com", status: "Moderate Activity", productivityScore: 59 },
  { name: "John Doe", extension: "+44090078601", email: "johndoe@onehomes.com", status: "Minimal Activity", productivityScore: 58 },
];

export const dashboardStats = {
  activeLeads: 452,
  uncontactedLeads: 122,
  averageCpl: 50.68,
};

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
