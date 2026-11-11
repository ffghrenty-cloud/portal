import Assistant from "./components/Assistant";
import type { Metadata } from "next";
import "./globals.css";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "ОршаЛён — оптовый портал",
  description:
    "Веб-портал для оптовых заказчиков РУПТП «Оршанский льнокомбинат»",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body>
        <Header />
        <main>{children}</main>
        <Assistant />
      </body>
    </html>
  );
}