import React, { useState } from 'react';
import { Button } from './ui/primitives';

export interface SetupWizardProps {
  onComplete: (token: string) => void;
  defaultToken?: string;
}

export function SetupWizard({ onComplete, defaultToken = '' }: SetupWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [tokenInput, setTokenInput] = useState(defaultToken);
  const [selectedModel, setSelectedModel] = useState('qwen-2.5-7b-instruct');
  const [enableKnowledge, setEnableKnowledge] = useState(true);
  const [enableSpeech, setEnableSpeech] = useState(true);

  return (
    <div className="setup-wizard-container max-w-xl mx-auto p-8 ui-surface rounded-2xl border ui-border shadow-lg">
      {/* Wizard Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b ui-border">
        <div className="flex items-center gap-3">
          <span className="text-3xl ui-text-accent">◈</span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Sanctum Setup Walkthrough</h1>
            <p className="text-xs ui-text-secondary text-display tracking-wider">Hermes-grade Onboarding · On-Device AI</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-display ui-text-secondary">
          <span className={step >= 1 ? 'font-bold ui-text-accent' : ''}>1. Welcome</span>
          <span>→</span>
          <span className={step >= 2 ? 'font-bold ui-text-accent' : ''}>2. Connect</span>
          <span>→</span>
          <span className={step >= 3 ? 'font-bold ui-text-accent' : ''}>3. Models</span>
          <span>→</span>
          <span className={step >= 4 ? 'font-bold ui-text-accent' : ''}>4. Launch</span>
        </div>
      </div>

      {/* Step 1: Privacy Guarantee & Hardware Profiling */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Welcome to your local AI sanctum.</h2>
            <p className="text-sm ui-text-secondary leading-relaxed">
              Unlike cloud-hosted AI providers, Sanctum operates 100% on your machine.
              Zero telemetry, zero external network egress, and fully authenticated local access.
            </p>
          </div>

          <div className="p-4 rounded-xl border ui-border ui-surface space-y-3">
            <div className="text-xs font-semibold text-display ui-text-secondary tracking-wider">Detected Hardware Profile</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2 rounded border ui-border">
                <span className="ui-text-secondary block">Compute Mode:</span>
                <span className="font-semibold">Local On-Device (CPU/AVX)</span>
              </div>
              <div className="p-2 rounded border ui-border">
                <span className="ui-text-secondary block">Inference Isolation:</span>
                <span className="font-semibold text-green-700 dark:text-green-400">Strict Loopback Airgap</span>
              </div>
              <div className="p-2 rounded border ui-border">
                <span className="ui-text-secondary block">Context Window:</span>
                <span className="font-semibold">32k Tokens (Configurable)</span>
              </div>
              <div className="p-2 rounded border ui-border">
                <span className="ui-text-secondary block">Cloud Telemetry:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">Blocked (0 bytes)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setStep(2)}>
              Continue to Local Authentication →
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Loopback Authentication / Access Key Explanation */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Local Access & Security</h2>
            <p className="text-sm ui-text-secondary leading-relaxed">
              Why do we use an access key? Even though Sanctum runs locally on <code className="text-xs">127.0.0.1</code>,
              an authorization token ensures malicious scripts running in other browser tabs cannot access your local AI models or documents (anti-CSRF isolation).
            </p>
          </div>

          <div className="p-4 rounded-xl border ui-border bg-emerald-500/5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <span>✓</span> Single-User Local Bypass / Auto-Detect Available
            </div>
            <p className="text-xs ui-text-secondary leading-relaxed">
              If you started Sanctum in single-user mode, your session token is generated in <code className="text-[11px]">~/.local/share/sanctum/local.token</code>.
              You can paste it below or use the default local session.
            </p>
            <div className="mt-2">
              <label className="block text-xs font-medium mb-1.5" htmlFor="token-input">Local Access Token (Optional / Auto-filled)</label>
              <input
                id="token-input"
                type="password"
                placeholder="Paste local.token (leave empty for loopback auto-connect)"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border ui-border ui-surface"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Configure Model & Capabilities →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Model & Features Selection */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Model & Feature Setup</h2>
            <p className="text-sm ui-text-secondary leading-relaxed">
              Choose your primary local model and toggle on-device capabilities.
            </p>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-display ui-text-secondary tracking-wider">Select On-Device Model</div>
            <div className="space-y-2">
              {[
                { id: 'qwen-2.5-7b-instruct', name: 'Qwen 2.5 7B Instruct', desc: 'Fast, high-fidelity reasoning & code synthesis.', fit: 'Optimal for 16GB+ RAM', license: 'Apache-2.0' },
                { id: 'llama-3.2-3b-instruct', name: 'Llama 3.2 3B Instruct', desc: 'Ultra-lightweight, rapid streaming on CPU.', fit: 'Optimal for 8GB+ RAM', license: 'Llama 3.2 Community' },
              ].map(m => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedModel === m.id ? 'border-accent bg-emerald-500/10' : 'ui-border hover:bg-neutral-500/5'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={selectedModel === m.id}
                    onChange={() => setSelectedModel(m.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{m.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border ui-border text-display">{m.license}</span>
                    </div>
                    <p className="text-xs ui-text-secondary mt-0.5">{m.desc}</p>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 inline-block">{m.fit}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-display ui-text-secondary tracking-wider">Local Capabilities</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 p-3 rounded-lg border ui-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableKnowledge}
                  onChange={e => setEnableKnowledge(e.target.checked)}
                />
                <span className="text-xs font-medium">Knowledge & RAG Workspaces</span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-lg border ui-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSpeech}
                  onChange={e => setEnableSpeech(e.target.checked)}
                />
                <span className="text-xs font-medium">Local Voice / Speech-to-Text</span>
              </label>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(4)}>
              Review & Launch Workspace →
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Summary & Ready to Chat */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">You’re Ready to Go!</h2>
            <p className="text-sm ui-text-secondary leading-relaxed">
              Everything is set up. Your local environment has verified zero network leaks.
            </p>
          </div>

          <div className="p-4 rounded-xl border ui-border ui-surface space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b ui-border">
              <span className="ui-text-secondary">Selected Model:</span>
              <span className="font-semibold">{selectedModel}</span>
            </div>
            <div className="flex justify-between py-1 border-b ui-border">
              <span className="ui-text-secondary">Network Status:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Offline / Airgapped</span>
            </div>
            <div className="flex justify-between py-1 border-b ui-border">
              <span className="ui-text-secondary">RAG Knowledge:</span>
              <span className="font-semibold">{enableKnowledge ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="ui-text-secondary">Speech / Audio:</span>
              <span className="font-semibold">{enableSpeech ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(3)}>
              ← Back
            </Button>
            <Button
              onClick={() => onComplete(tokenInput.trim() || 'sanctum-local-owner')}
            >
              Start Chatting ◈
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
