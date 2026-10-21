"use client";

import React, { useState } from "react";
import { Image as ImageIcon, X, Eye, Scan, Sparkles } from "lucide-react";

interface VisionInspectorProps {
  imageSrc: string;
  imageName: string;
  imageDimensions?: { width: number; height: number };
  onRemove: () => void;
}

export const VisionInspector: React.FC<VisionInspectorProps> = ({
  imageSrc,
  imageName,
  imageDimensions,
  onRemove,
}) => {
  const [isInspecting, setIsInspecting] = useState(false);

  return (
    <div className="flex items-center gap-3 p-2 bg-zinc-900 border border-indigo-500/30 rounded-xl">
      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-black border border-white/10 shrink-0">
        <img
          src={imageSrc}
          alt={imageName}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-indigo-500/10 pointer-events-none" />
      </div>

      <div className="flex-1 min-w-0 text-xs">
        <div className="font-medium text-zinc-200 truncate">{imageName}</div>
        <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-2 mt-0.5">
          <span>Multimodal Tensor</span>
          {imageDimensions && (
            <span>
              • {imageDimensions.width}×{imageDimensions.height}px
            </span>
          )}
          <span className="text-emerald-400">Ready</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setIsInspecting(!isInspecting)}
          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          title="Inspect Vision Feature Map"
        >
          <Scan className="w-3.5 h-3.5 text-indigo-400" />
        </button>
        <button
          onClick={onRemove}
          className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
          title="Remove Image"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
