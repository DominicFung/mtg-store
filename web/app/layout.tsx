import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { CartProvider } from './lib/useCart';
import AppBar from "./components/appBar";
import SiteFooter from "./components/siteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://themanaramp.ca"),
  title: {
    default: "The Mana Ramp",
    template: "%s · The Mana Ramp",
  },
  description: "3D-printed Commander deck boxes for Magic: The Gathering. Search your commander, we print the box.",
  openGraph: {
    title: "The Mana Ramp",
    description: "3D-printed Commander deck boxes for Magic: The Gathering.",
    siteName: "The Mana Ramp",
    type: "website",
    url: "https://themanaramp.ca",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Mana Ramp",
    description: "3D-printed Commander deck boxes for Magic: The Gathering.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <CartProvider>
          <AppBar />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
