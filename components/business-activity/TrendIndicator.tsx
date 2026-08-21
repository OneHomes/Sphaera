import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { TrendDirection } from "@/lib/businessActivityData";

const trendConfig: Record<
  TrendDirection,
  { icon: typeof ArrowUpRight; colorClass: string }
> = {
  up: { icon: ArrowUpRight, colorClass: "text-status-active" },
  down: { icon: ArrowDownRight, colorClass: "text-status-inactive" },
  flat: { icon: Minus, colorClass: "text-ink-500" },
};

export function TrendIndicator({ direction }: { direction: TrendDirection }) {
  const { icon: Icon, colorClass } = trendConfig[direction];
  return <Icon className={`h-3.5 w-3.5 ${colorClass}`} />;
}
