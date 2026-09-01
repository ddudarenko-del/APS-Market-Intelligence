import type { Metadata } from "next";
import { MarketDashboard } from "./MarketDashboard";

export const metadata: Metadata = {
  title: "APS Market Intelligence",
  description:
    "Интерактивное исследование продуктового соответствия stablecoin-powered global money app на восьми рынках.",
};

export default function Home() {
  return <MarketDashboard />;
}
