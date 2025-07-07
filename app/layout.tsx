import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { RootProvider } from "@/contexts/RootProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Learning Assistant",
    template: "%s | Learning Assistant",
  },
  description: "Personalized learning assistant with adaptive content and AI-powered recommendations",
  keywords: ["learning", "AI", "education", "personalized", "adaptive"],
  authors: [{ name: "Learning Assistant Team" }],
  creator: "Learning Assistant",
  publisher: "Learning Assistant",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    title: "Learning Assistant",
    description: "Personalized learning assistant with adaptive content and AI-powered recommendations",
    siteName: "Learning Assistant",
  },
  twitter: {
    card: "summary_large_image",
    title: "Learning Assistant",
    description: "Personalized learning assistant with adaptive content and AI-powered recommendations",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <RootProvider>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}