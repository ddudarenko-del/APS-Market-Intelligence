import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APS Market Intelligence",
  description:
    "Интерактивное исследование продуктового соответствия stablecoin-powered global money app на восьми рынках.",
  openGraph: {
    title: "APS Market Intelligence",
    description:
      "Открытые данные, экспертные интервью, локальная конкуренция, барьеры входа и каналы привлечения на восьми рынках.",
    type: "website",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
