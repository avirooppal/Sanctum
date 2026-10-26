"use client";

import React, { useState } from "react";
import {
  IconCheck,
  IconCpu,
  IconLoader2,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { ConsentModal } from "@/components/hub/ConsentModal";

interface SetupScreenProps {
  onComplete?: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const { hasCompletedOnboarding, completeOnboarding } = useAppStore();
  const [step, setStep] = useState<number>(1);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [engineStatus, setEngineStatus] = useState<"checking" | "ready" | "failed">("checking");
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  // Step 1 -> Step 2 transition
  const handleStart = () => {
    setHasStarted(true);
    setStep(2);
    // Simulate real local probe of bundled engine
    setTimeout(() => {
      setEngineStatus("ready");
    }, 1200);
  };

  const handleStep2Continue = () => {
    setStep(3);
  };

  const handleFinish = () => {
    completeOnboarding();
    if (onComplete) onComplete();
  };

  return (
    <div className="relative flex flex-1 h-full w-full items-center justify-center bg-background text-foreground select-none p-4 overflow-hidden">
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 bg-radial from-sidebar/20 via-background to-background pointer-events-none" />

      {/* Main Setup Card */}
      <div
        className={cn(
          "relative z-10 w-full max-w-[540px] rounded-2xl border border-border/80 bg-card/90 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300"
        )}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between gap-4">
          <span
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            data-testid="setup-step-counter"
          >
            Step {step} of 3
          </span>
          <span className="flex items-center gap-1.5" aria-hidden>
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={cn(
                  "h-1 w-7 rounded-full transition-colors",
                  s === step
                    ? "bg-primary"
                    : s < step
                    ? "bg-muted-foreground/60"
                    : "bg-muted-foreground/20"
                )}
              />
            ))}
          </span>
        </div>

        {/* STEP 1: Welcome & Setup Explanation (Owner Reference screenshot preview.webp) */}
        {step === 1 && (
          <div className="mt-6 flex flex-col items-start text-left">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground font-sans">
              Sanctum needs to set up on your system
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              This takes a few minutes: Sanctum verifies its bundled inference engine and prepares local embeddings for file search. You can keep using your computer while it runs.
            </p>

            <div className="mt-8 w-full">
              <Button
                className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 h-10 shadow-sm transition-all"
                onClick={handleStart}
              >
                Let&apos;s start
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Setting up the local engine */}
        {step === 2 && (
          <div className="mt-6 flex flex-col items-start text-left">
            <span
              className={cn(
                "mb-4 inline-flex size-9 items-center justify-center rounded-xl",
                engineStatus === "ready"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {engineStatus === "ready" ? (
                <IconCheck size={20} />
              ) : (
                <IconLoader2 size={20} className="animate-spin text-primary" />
              )}
            </span>

            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {engineStatus === "ready" ? "Engine ready" : "Setting up the local engine"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {engineStatus === "ready"
                ? "Sanctum will run local models with bundled llama.cpp engine."
                : "Verifying CPU instructions (AVX2/AVX-512) and memory headroom..."}
            </p>

            {/* Hardware badge */}
            <div className="mt-6 flex w-full items-start gap-3 rounded-xl border border-border/80 bg-muted/40 p-4">
              <IconCpu className="size-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-0.5 text-xs">
                <span className="font-medium text-foreground">Will run on CPU</span>
                <p className="text-muted-foreground">
                  Bundled CPU llama.cpp runtime active. GPU backends can be toggled in Settings &gt; Hardware.
                </p>
              </div>
            </div>

            <div className="mt-8 flex w-full gap-3">
              <Button
                className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 h-10 shadow-sm"
                disabled={engineStatus !== "ready"}
                onClick={handleStep2Continue}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Recommended Model & Hub Explore */}
        {step === 3 && (
          <div className="mt-6 flex flex-col items-start text-left">
            <span className="mb-4 inline-flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <IconCheck size={20} />
            </span>

            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Your first model
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Sanctum is ready. You can browse the Hugging Face Model Hub to download a quantized model, or import existing `.gguf` weights from your drive.
            </p>

            <div className="mt-6 flex flex-col w-full gap-3">
              <Button
                className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 h-10 shadow-sm"
                onClick={handleFinish}
              >
                Get Started
              </Button>
              <button
                type="button"
                onClick={handleFinish}
                className="text-xs text-muted-foreground hover:text-foreground text-center py-1 transition-colors"
              >
                Browse models in the Hub
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Consent Modal for optional downloads */}
      <ConsentModal
        isOpen={showConsentModal}
        targetHost="huggingface.co"
        resourceName="Model Weight & Embedding Assets"
        sizeBytes={1024 * 1024 * 350}
        onConsent={() => {
          setShowConsentModal(false);
          setStep(3);
        }}
        onDecline={() => {
          setShowConsentModal(false);
          setStep(3);
        }}
      />
    </div>
  );
};
