/** plural(1, "lead") -> "1 lead"; plural(1284, "lead") -> "1,284 leads". */
export function plural(n: number, singular: string, pluralForm = singular + "s"): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? singular : pluralForm}`;
}
