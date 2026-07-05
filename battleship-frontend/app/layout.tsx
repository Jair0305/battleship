import type { Metadata } from "next";
import { Geist, Geist_Mono, Pixelify_Sans } from "next/font/google";
import "./globals.css";
import Header from './components/Header';
import { GameFooter, GameShell } from "./components/nightly/primitives";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixel" });
const nightlyNav = <Header />;
const nightlyFooter = <GameFooter />;

export const metadata: Metadata = {
  title: "Nightly Games | Battleship",
  description: "Battleship en la plataforma Nightly Games",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} ${pixel.variable} bg-night font-ui text-night-text`}>
        <GameShell nav={nightlyNav} footer={nightlyFooter}>
          {children}
        </GameShell>
      </body>
    </html>
  );
}
