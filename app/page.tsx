import type { Metadata } from "next";
import { MarketDashboard } from "./MarketDashboard";

export const metadata: Metadata = {
  title: "APS Market Intelligence",
  description:
    "Сравнительное исследование восьми рынков для crypto-linked payments, digital assets и карт.",
};

export default function Home() {
  return <MarketDashboard />;
}
