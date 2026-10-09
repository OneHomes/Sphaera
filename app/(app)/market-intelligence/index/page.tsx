import "@fontsource/monda";
import AreaInsights from "@/components/market-intelligence/AreaInsights";

export const metadata = {
  title: "Property Index | Sphaera",
  description: "Explore monthly property asking prices and compare published market histories.",
};

export default function Page() {
  return <AreaInsights initialTab="index" />;
}
