import "@fontsource/monda";
import AreaInsights from "@/components/market-intelligence/AreaInsights";

export const metadata = {
  title: "Five-Year Forecast | Sphaera Market Intelligence",
  description: "Explore transparent five-year scenarios for Pakistan real estate market growth.",
};

export default function Page() {
  return <AreaInsights initialTab="forecast" />;
}
