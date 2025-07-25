import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learning Assistant",
  description: "Your personal learning companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}