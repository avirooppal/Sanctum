import React, { useState } from 'react';

export interface CookbookModel {
  id: string;
  name: string;
  category: 'Coding' | 'General' | 'Reasoning' | 'Vision' | 'Lightweight';
  parameters: string;
  quantization: string;
  fileSizeBytes: number;
  requiredRamMb: number;
  requiredVramMb: number;
  description: string;
  license: string;
  recommended: boolean;
  installed: boolean;
}

const COOKBOOK_MODELS: CookbookModel[] = [
  {
    id: 'qwen2.5-coder-7b',
    name: 'Qwen 2.5 Coder 7B Instruct',
    category: 'Coding',
    parameters: '7.6B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 4680000000,
    requiredRamMb: 5800,
    requiredVramMb: 4900,
    description: 'Premier open-weight coding specialist. Excellent code generation, debugging, and terminal tool use.',
    license: 'Apache-2.0',
    recommended: true,
    installed: true,
  },
  {
    id: 'llama-3.2-3b-instruct',
    name: 'Llama 3.2 3B Instruct',
    category: 'Lightweight',
    parameters: '3.2B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 2100000000,
    requiredRamMb: 2900,
    requiredVramMb: 2400,
    description: 'Ultra-fast lightweight generalist optimized for edge laptops and memory-constrained workstations.',
    license: 'Llama 3.2 Community',
    recommended: true,
    installed: true,
  },
  {
    id: 'deepseek-r1-distill-qwen-8b',
    name: 'DeepSeek R1 Distill Qwen 8B',
    category: 'Reasoning',
    parameters: '8.2B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 4950000000,
    requiredRamMb: 6400,
    requiredVramMb: 5400,
    description: 'Specialized reasoning and reflection model exhibiting internal chain-of-thought generation before answers.',
    license: 'MIT',
    recommended: false,
    installed: false,
  },
  {
    id: 'mistral-7b-instruct-v0.3',
    name: 'Mistral 7B Instruct v0.3',
    category: 'General',
    parameters: '7.2B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 4400000000,
    requiredRamMb: 5600,
    requiredVramMb: 4800,
    description: 'Versatile foundation model with native function calling and 32k context support.',
    license: 'Apache-2.0',
    recommended: false,
    installed: true,
  },
  {
    id: 'minicpm-v-2.6-8b',
    name: 'MiniCPM-V 2.6 Multi-Modal',
    category: 'Vision',
    parameters: '8B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 5200000000,
    requiredRamMb: 6800,
    requiredVramMb: 5800,
    description: 'On-device vision-language model for dense image captioning, OCR, and document layout parsing.',
    license: 'Apache-2.0',
    recommended: false,
    installed: false,
  },
];

export const CookbookPanel: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [systemRamMb] = useState<number>(16384);
  const [gpuVramMb] = useState<number>(8192);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [models, setModels] = useState<CookbookModel[]>(COOKBOOK_MODELS);

  const categories = ['All', 'Coding', 'General', 'Reasoning', 'Vision', 'Lightweight'];

  const filteredModels = models.filter((m) =>
    selectedCategory === 'All' ? true : m.category === selectedCategory
  );

  const handleInstall = (id: string) => {
    setDownloadingId(id);
    setDownloadProgress(5);
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setDownloadingId(null);
          setModels((current) =>
            current.map((m) => (m.id === id ? { ...m, installed: true } : m))
          );
          return 100;
        }
        return prev + 15;
      });
    }, 200);
  };

  const getFitAssessment = (requiredVram: number, requiredRam: number) => {
    if (requiredVram <= gpuVramMb) {
      return { label: 'Optimal GPU Fit', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    }
    if (requiredRam <= systemRamMb) {
      return { label: 'CPU RAM Offload', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
    }
    return { label: 'Exceeds Memory', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)' };
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0b0f17',
        color: '#f8fafc',
        overflowY: 'auto',
        padding: '24px 32px',
        gap: '24px',
      }}
    >
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🍳</span> Model Cookbook & Hardware Hub
        </h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
          Hardware-aware open-weight model recommendations, verified GGUF downloads, and one-click serving.
        </p>
      </div>

      {/* Hardware Telemetry Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          backgroundColor: '#121824',
          border: '1px solid #1e293b',
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Host Memory</span>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
            {(systemRamMb / 1024).toFixed(1)} GB RAM
          </div>
          <span style={{ fontSize: '11px', color: '#10b981' }}>System Available</span>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>GPU Acceleration</span>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
            {(gpuVramMb / 1024).toFixed(1)} GB VRAM
          </div>
          <span style={{ fontSize: '11px', color: '#38bdf8' }}>Vulkan / Metal / DirectML</span>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Target Quantization</span>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
            Q4_K_M (4-bit medium)
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Optimal Speed/Quality Ratio</span>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: '20px',
              border: selectedCategory === cat ? '1px solid #38bdf8' : '1px solid #1e293b',
              backgroundColor: selectedCategory === cat ? '#1a2332' : '#121824',
              color: selectedCategory === cat ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: selectedCategory === cat ? 600 : 400,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Models Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredModels.map((m) => {
          const fit = getFitAssessment(m.requiredVramMb, m.requiredRamMb);
          const isDownloading = downloadingId === m.id;

          return (
            <div
              key={m.id}
              style={{
                backgroundColor: '#121824',
                border: m.installed ? '1px solid #1e293b' : '1px solid #141d2b',
                borderRadius: '8px',
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '24px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>{m.name}</h3>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: fit.bg,
                      color: fit.color,
                      fontWeight: 600,
                    }}
                  >
                    {fit.label}
                  </span>
                  {m.recommended && (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        fontWeight: 600,
                      }}
                    >
                      ★ Recommended
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>{m.description}</p>

                <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#64748b', marginTop: '10px' }}>
                  <span>Params: <strong style={{ color: '#cbd5e1' }}>{m.parameters}</strong></span>
                  <span>Format: <strong style={{ color: '#cbd5e1' }}>GGUF ({m.quantization})</strong></span>
                  <span>Disk: <strong style={{ color: '#cbd5e1' }}>{(m.fileSizeBytes / 1e9).toFixed(1)} GB</strong></span>
                  <span>RAM Fit: <strong style={{ color: '#cbd5e1' }}>{(m.requiredRamMb / 1024).toFixed(1)} GB</strong></span>
                  <span>License: <strong style={{ color: '#cbd5e1' }}>{m.license}</strong></span>
                </div>
              </div>

              <div>
                {m.installed ? (
                  <span
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      backgroundColor: '#1a2332',
                      color: '#10b981',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid #1e293b',
                      display: 'inline-block',
                    }}
                  >
                    ✓ Ready to Use
                  </span>
                ) : isDownloading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#38bdf8' }}>Downloading {downloadProgress}%...</span>
                    <div style={{ width: '120px', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${downloadProgress}%`, height: '100%', background: '#38bdf8' }} />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleInstall(m.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      backgroundColor: '#38bdf8',
                      color: '#0b0f17',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Install & Serve
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
