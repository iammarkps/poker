import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Texas Hold'em Poker",
  description: "Play Texas Hold'em poker with friends",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
