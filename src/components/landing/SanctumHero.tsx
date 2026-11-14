"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Download, Menu, X } from "lucide-react";

const GITHUB_URL = "https://github.com/avirooppal/Sanctum";
const EXE_DOWNLOAD_URL =
  "https://github.com/avirooppal/Sanctum/raw/main/Sanctum.exe";

const NAV_LINKS = [{ label: "GitHub", href: GITHUB_URL }] as const;

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260803_192301_9231ed6b-c55c-4a48-909c-4ebe11cf2e11.mp4";

const CTA_GRADIENT = "linear-gradient(to bottom, #2B2B2B, #101010)";

export function SanctumHero() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMenuOpen]);

  return (
    <section
      className="relative h-screen w-full overflow-hidden antialiased select-text"
      style={{
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
      />

      <div className="relative z-10 flex h-full flex-col">
        <nav className="flex items-center justify-between px-5 py-5 sm:px-8 sm:py-6 lg:px-12">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 focus:outline-none"
            aria-label="Sanctum on GitHub"
          >
            <img
              src="/logo.jpg"
              alt="Sanctum logo"
              className="h-7 w-7 rounded-lg border border-white/15 object-cover"
            />
            <span className="text-lg font-semibold text-[#010101] lg:text-white">
              sanctum
            </span>
          </a>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-1.5 backdrop-blur-lg">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span>{item.label}</span>
                </a>
              ))}
            </div>

            <a
              href={EXE_DOWNLOAD_URL}
              download="Sanctum.exe"
              className="inline-flex items-center gap-1.5 self-stretch rounded-full px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: CTA_GRADIENT }}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Download .exe</span>
            </a>
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            className="relative z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-lg md:hidden"
          >
            <Menu
              className={`h-5 w-5 text-[#010101] transition-all duration-300 lg:text-white ${
                isMenuOpen
                  ? "rotate-90 scale-0 opacity-0"
                  : "rotate-0 scale-100 opacity-100"
              }`}
              aria-hidden="true"
            />
            <X
              className={`absolute h-5 w-5 text-white transition-all duration-300 ${
                isMenuOpen
                  ? "rotate-0 scale-100 opacity-100"
                  : "-rotate-90 scale-0 opacity-0"
              }`}
              aria-hidden="true"
            />
          </button>
        </nav>

        <div
          className={`fixed inset-0 z-40 bg-black/80 backdrop-blur-md transition-opacity duration-300 md:hidden ${
            isMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />

        <aside
          aria-hidden={!isMenuOpen}
          className={`fixed right-0 top-0 z-40 flex h-full w-72 flex-col bg-black/90 backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden ${
            isMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col gap-2 px-6 pt-24">
            {NAV_LINKS.map((item, index) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMenuOpen(false)}
                style={{
                  transitionDelay: isMenuOpen ? `${(index + 1) * 60}ms` : "0ms",
                }}
                className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-left text-base font-medium text-white/80 transition-all duration-300 hover:bg-white/10 hover:text-white ${
                  isMenuOpen
                    ? "translate-x-0 opacity-100"
                    : "translate-x-6 opacity-0"
                }`}
              >
                <span>{item.label}</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            ))}
          </div>

          <div
            className={`mt-auto px-6 pb-10 transition-all duration-[400ms] ${
              isMenuOpen
                ? "translate-y-0 opacity-100 delay-300"
                : "translate-y-4 opacity-0 delay-0"
            }`}
          >
            <a
              href={EXE_DOWNLOAD_URL}
              download="Sanctum.exe"
              onClick={() => setIsMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: CTA_GRADIENT }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download Sanctum.exe</span>
            </a>
          </div>
        </aside>

        <main className="mt-auto flex flex-col gap-6 px-5 pb-8 sm:gap-8 sm:px-8 sm:pb-12 lg:flex-row lg:items-end lg:justify-between lg:px-12 lg:pb-16">
          <div>
            <div className="max-w-xl">
              <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight text-[#010101] sm:text-4xl lg:text-[3.5rem] lg:text-white">
                Your sovereign AI workspace on Windows
              </h1>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
              <a
                href={EXE_DOWNLOAD_URL}
                download="Sanctum.exe"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: CTA_GRADIENT }}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download Sanctum.exe</span>
              </a>

              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-white/90"
              >
                <span>GitHub Repository</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="flex w-full flex-col gap-4 sm:flex-row lg:w-auto lg:gap-5">
            <div className="flex flex-col justify-between rounded-2xl bg-white/10 p-5 backdrop-blur-lg sm:w-64 sm:p-6">
              <p
                className="text-3xl font-normal tracking-tight text-[#010101] sm:text-4xl lg:text-white"
                style={{ fontFamily: "'Silkscreen', cursive" }}
              >
                100%
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#010101]/70 sm:mt-4 lg:text-white/70">
                On-device inference with Ollama, document RAG, and offline
                Windows dictation — zero cloud egress.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-lg sm:w-64 sm:p-6">
              <div className="mb-3 flex items-center gap-2 sm:mb-4">
                <img
                  src="/logo.jpg"
                  alt="Sanctum logo"
                  className="h-6 w-6 rounded object-cover"
                />
                <span className="text-sm font-semibold text-[#010101] lg:text-white">
                  Sanctum · v1.0 Beta
                </span>
              </div>

              <p className="text-sm leading-relaxed text-[#010101]/80 lg:text-white/80">
                Native C# + WebView2 desktop host wrapping Next.js, Zustand, and
                Ollama. Auto-installs runtime &amp; Qwen3 1.7B on first launch.
              </p>

              <div className="mt-4 flex items-center justify-between gap-3 sm:mt-5">
                <div>
                  <p className="text-sm font-semibold text-[#010101] lg:text-white">
                    Windows 10 / 11
                  </p>
                  <p className="text-xs text-[#010101]/60 lg:text-white/60">
                    4.1 MB standalone EXE
                  </p>
                </div>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-[#010101]/80 underline underline-offset-4 hover:opacity-80 lg:text-white/80"
                >
                  avirooppal/Sanctum
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
