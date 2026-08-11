import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APS Market Intelligence",
  description:
    "Интерактивная сравнительная аналитика восьми рынков APS с отдельным KAST / Product Fit.",
  openGraph: {
    title: "APS Market Intelligence",
    description:
      "Проверенная сравнительная аналитика восьми рынков APS: исходный рейтинг, KAST / Product Fit и конкурентная среда.",
    type: "website",
    images: ["/og-kast-fit.png"],
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
