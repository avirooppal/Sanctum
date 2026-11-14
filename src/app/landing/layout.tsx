import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sanctum — Sovereign Local AI Workspace",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Silkscreen:wght@400;700&display=swap"
      />
      {children}
    </>
  );
}
