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
  onComplete?: (destination?: "chat" | "hub") => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const { hasCompletedOnboarding, completeOnboarding } = useAppStore();
  const [step, setStep] = useState<number>(1);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [engineStatus, setEngineStatus] = useState<"checking" | "ready" | "failed">("checking");
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  // Step 1 -> Step 2 transition
  const handleStart = async () => {
    setHasStarted(true);
    setStep(2);
    setEngineStatus("checking");
    try {
      const response = await fetch("/api/ollama/models", { signal: AbortSignal.timeout(8000) });
      const data = await response.json();
      setEngineStatus(response.ok && data.online === true ? "ready" : "failed");
    } catch { setEngineStatus("failed"); }
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
              Sanctum checks your local inference service. You can continue offline and connect a model later.
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
              {engineStatus === "ready" ? "Engine ready" : engineStatus === "failed" ? "Local engine offline" : "Checking local engine"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {engineStatus === "ready"
                ? "Connected to your local inference service."
                : engineStatus === "failed" ? "Start Ollama with ollama serve, then retry. You can also continue to browse your workspace." : "Checking the local inference service…"}
            </p>

            {/* Hardware badge */}
            <div className="mt-6 flex w-full items-start gap-3 rounded-xl border border-border/80 bg-muted/40 p-4">
              <IconCpu className="size-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-0.5 text-xs">
                <span className="font-medium text-foreground">Local inference</span>
                <p className="text-muted-foreground">
                  Your inference service manages CPU and GPU execution. Model files alone do not mean the service is running.
                </p>
              </div>
            </div>

            {engineStatus === "failed" && <Button variant="outline" className="mt-4" onClick={handleStart}>Retry connection</Button>}
            <div className="mt-8 flex w-full gap-3">
              <Button
                className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 h-10 shadow-sm"
                disabled={engineStatus === "checking"}
                onClick={handleStep2Continue}
              >
                {engineStatus === "failed" ? "Continue offline" : "Continue"}
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
              Open the Hub to browse models. For browser chat, install a model in Ollama and keep the local service running.
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
                onClick={() => { completeOnboarding(); onComplete?.("hub"); }}
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
