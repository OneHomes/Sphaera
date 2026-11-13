// The internal costs page (/internal/costs) isn't in the menu; only these
// people can open it, everyone else gets a 404.
const COSTS_VISIBLE_TO = ["owais.shaikh@onehomes.com"];

export function canSeeCosts(email: string | null | undefined): boolean {
  return COSTS_VISIBLE_TO.includes((email ?? "").trim().toLowerCase());
}
