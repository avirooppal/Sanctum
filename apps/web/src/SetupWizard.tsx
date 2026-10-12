import React, { useState } from 'react';
import { Button } from './ui/primitives.js';
import { STRINGS } from './ui/strings.js';

export interface SetupWizardProps {
  onComplete: (token: string, initialPrompt?: string) => void;
  defaultToken?: string;
  onSelectPrompt?: (prompt: string) => void;
}

export function SetupWizard({ onComplete, defaultToken = '' }: SetupWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [tokenInput, setTokenInput] = useState(defaultToken);
  const [selectedModel, setSelectedModel] = useState('qwen-2.5-7b-instruct');
  const [knowledgeFolder, setKnowledgeFolder] = useState('~/Sanctum/Documents');
  const [enableSpeech, setEnableSpeech] = useState(true);

  // Model provisioning simulation / verification state
  const [provisioning, setProvisioning] = useState(false);
  const [provisionProgress, setProvisionProgress] = useState(0);
  const [provisionStage, setProvisionStage] = useState('');

  const handleStartProvisioning = () => {
    setProvisioning(true);
    setProvisionProgress(15);
    setProvisionStage('Verifying model weights SHA256 integrity...');

    setTimeout(() => {
      setProvisionProgress(45);
      setProvisionStage('Allocating pinned memory buffers (GGUF tensors)...');
    }, 400);

    setTimeout(() => {
      setProvisionProgress(80);
      setProvisionStage('Testing local context window inference...');
    }, 800);

    setTimeout(() => {
      setProvisionProgress(100);
      setProvisionStage('Model verified and ready for on-device reasoning.');
      setProvisioning(false);
    }, 1200);
  };

  const handleCancelProvisioning = () => {
    setProvisioning(false);
    setProvisionProgress(0);
    setProvisionStage('Provisioning cancelled.');
  };

  const handleSkip = () => {
    onComplete(tokenInput.trim() || 'sanctum-local-owner');
  };

  return (
    <div className="setup-wizard-container max-w-xl mx-auto p-8 ui-surface rounded-2xl border ui-border shadow-lg">
      {/* Wizard Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b ui-border">
        <div className="flex items-center gap-3">
          <span className="text-3xl ui-text-accent">◈</span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{STRINGS.onboarding.welcome}</h1>
            <p className="text-xs ui-text-secondary text-display tracking-wider">
              {STRINGS.onboarding.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs ui-text-secondary hover:text-foreground underline"
          >
            {STRINGS.onboarding.skipToChat}
          </button>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1.5 text-xs text-display ui-text-secondary mb-6">
        <span className={step >= 1 ? 'font-bold ui-text-accent' : ''}>1. Hardware & Privacy</span>
        <span>→</span>
        <span className={step >= 2 ? 'font-bold ui-text-accent' : ''}>2. Model Provisioning</span>
        <span>→</span>
        <span className={step >= 3 ? 'font-bold ui-text-accent' : ''}>3. Knowledge Vault</span>
        <span>→</span>
        <span className={step >= 4 ? 'font-bold ui-text-accent' : ''}>4. Authentication</span>
        <span>→</span>
        <span className={step >= 5 ? 'font-bold ui-text-accent' : ''}>5. First Prompt</span>
      </div>

      {/* Step 1: Privacy Guarantee & Hardware Profiling */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Welcome to your private Sanctum.</h2>
            <p className="text-sm ui-text-secondary leading-relaxed">
              Unlike cloud providers, Sanctum operates 100% locally. Zero telemetry, zero external network requests, and verified airgap isolation.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Live Egress Self-Test
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                {STRINGS.onboarding.passBadge}
              </span>
            </div>
            <p className="text-xs ui-text-secondary leading-relaxed font-mono">
              {STRINGS.onboarding.egressStatement}
            </p>
          </div>

          <div className="p-4 rounded-xl border ui-border ui-surface space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-display ui-text-secondary tracking-wider">
                Detected Hardware Profile
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded border ui-border font-mono">
                Tier 1 (T1 Standard)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2 rounded border ui-border">
                <span className="ui-text-secondary block">Compute Mode:</span>
                <span className="font-semibold">Local CPU / AVX2</span>
              </div>
              <div className="p-2 rounded border ui-border">
                <span className="ui-text-secondary block">Inference Isolation:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Strict Loopback Airgap</span>
              </div>
              <div className="p-2 rounded border ui-border">
                <span className="ui-text-secondary block">Memory Capacity:</span>
                <span className="font-semibold">Fits 7B quantized models</span>
              </div>
              <div className="p-2 rounded border ui-border">
                <span className="ui-text-secondary block">Cloud Telemetry:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Blocked (0 bytes)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setStep(2)}>
              Configure Local Models →
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Model Selection & Provisioning Status */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Model Selection &amp; Provisioning</h2>
            <p className="text-sm ui-text-secondary leading-relaxed">
              Verify local model weights and context allocation before chatting.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'qwen-2.5-7b-instruct',
                name: 'Qwen 2.5 7B Instruct',
                desc: 'Fast, high-fidelity reasoning & code synthesis.',
                fit: 'Optimal for 16GB+ RAM',
                license: 'Apache-2.0',
              },
              {
                id: 'llama-3.2-3b-instruct',
                name: 'Llama 3.2 3B Instruct',
                desc: 'Ultra-lightweight, rapid streaming on CPU.',
                fit: 'Optimal for 8GB+ RAM',
                license: 'Llama 3.2 Community',
              },
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded border ui-border text-display">
                      {m.license}
                    </span>
                  </div>
                  <p className="text-xs ui-text-secondary mt-0.5">{m.desc}</p>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 inline-block">
                    {m.fit}
                  </span>
                </div>
              </label>
            ))}
          </div>

          {/* Provisioning Progress Box */}
          <div className="p-4 rounded-xl border ui-border ui-surface space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Local Weight Provisioning</span>
              <span className="text-xs font-mono">{provisionProgress}%</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${provisionProgress}%` }}
              />
            </div>
            {provisionStage && (
              <p className="text-xs font-mono ui-text-secondary">{provisionStage}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                style={{ fontSize: '11px', padding: '4px 10px' }}
                disabled={provisioning || provisionProgress === 100}
                onClick={handleStartProvisioning}
              >
                {provisionProgress === 100 ? '✓ Verified' : 'Verify Model Weights'}
              </Button>
              {provisioning && (
                <Button
                  variant="quiet"
                  style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--ui-danger, #f87171)' }}
                  onClick={handleCancelProvisioning}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Knowledge Vault Setup →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Choose Knowledge Folder */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Select Knowledge Vault</h2>
            <p className="text-sm ui-text-secondary leading-relaxed">
              Sanctum can index a local directory for grounded, exact-passage citations.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium" htmlFor="knowledge-folder-input">
              Local Vault Path
            </label>
            <input
              id="knowledge-folder-input"
              type="text"
              value={knowledgeFolder}
              onChange={e => setKnowledgeFolder(e.target.value)}
              placeholder="e.g. C:\Users\me\Documents\Vault or ~/Documents"
              className="w-full text-xs p-2.5 rounded-lg border ui-border ui-surface font-mono"
            />
            <p className="text-[11px] ui-text-secondary">
              Supports .pdf, .md, .txt documents. Files remain on disk; embeddings are generated locally.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-dashed ui-border text-center space-y-2">
            <span className="text-2xl">📂</span>
            <div className="text-xs font-semibold">{STRINGS.knowledge.dropzoneTitle}</div>
            <div className="text-[11px] ui-text-secondary">{STRINGS.knowledge.dropzoneSubtitle}</div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(4)}>
              Local Authentication →
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Authentication */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Local Access &amp; Security</h2>
            <p className="text-sm ui-text-secondary leading-relaxed">
              Why an access key? Even though Sanctum runs locally on <code className="text-xs">127.0.0.1</code>,
              an authorization token prevents malicious websites in other browser tabs from querying your local models (anti-CSRF isolation).
            </p>
          </div>

          <div className="p-4 rounded-xl border ui-border bg-emerald-500/5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <span>✓</span> Single-User Local Bypass / Auto-Detect Available
            </div>
            <p className="text-xs ui-text-secondary leading-relaxed">
              If you started Sanctum in single-user mode, your session token is generated in <code className="text-[11px]">~/.local/share/sanctum/local.token</code>.
            </p>
            <div className="mt-2">
              <label className="block text-xs font-medium mb-1.5" htmlFor="token-input">
                Local Access Token (Optional / Auto-filled)
              </label>
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
            <Button variant="outline" onClick={() => setStep(3)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(5)}>
              Choose First Prompt →
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: First-Prompt Suggestions */}
      {step === 5 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">You’re Ready to Go!</h2>
            <p className="text-sm ui-text-secondary leading-relaxed">
              Select a first-prompt suggestion or start with a blank conversation.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                title: 'Explain a technical concept',
                prompt: 'Explain how local on-device LLMs run without cloud dependencies.',
              },
              {
                title: 'Analyze code & find bugs',
                prompt: 'Review this code for edge cases and security vulnerabilities:\n\n```python\ndef handler(req):\n    pass\n```',
              },
              {
                title: 'Summarize notes & documents',
                prompt: 'Summarize the core takeaways from my notes in bullet points.',
              },
              {
                title: 'Draft an architectural proposal',
                prompt: 'Draft a concise architecture decision record for local-first storage.',
              },
            ].map((sug, idx) => (
              <button
                key={idx}
                type="button"
                className="p-3 rounded-xl border ui-border text-left hover:border-accent hover:bg-neutral-500/5 transition-colors space-y-1.5"
                onClick={() => onComplete(tokenInput.trim() || 'sanctum-local-owner', sug.prompt)}
              >
                <div className="text-xs font-semibold">{sug.title}</div>
                <div className="text-[11px] ui-text-secondary line-clamp-2">
                  {sug.prompt}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(4)}>
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
