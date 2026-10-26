import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sanctum | Sovereign Local Private AI Workspace",
  description:
    "Unified local client workspace for running open-source LLMs, Deep Research pipelines, multi-agent arenas, speech recognition, and private RAG vector vaults entirely on-device.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface-base text-foreground font-sans antialiased overflow-hidden select-none">
        {children}
        <Toaster position="bottom-right" theme="dark" richColors closeButton />
      </body>
    </html>
  );
}
