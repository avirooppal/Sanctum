import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DEFAULT_OLLAMA_ENDPOINT } from "@/lib/constants";

interface DiscoveredModel {
  name: string;
  model: string;
  size: number;
  modified_at?: string;
  details: {
    family: string;
    parameter_size: string;
    quantization_level: string;
    context_length: number;
    source?: string;
  };
}

function scanOllamaManifestsOnDisk(seen: Set<string>, out: DiscoveredModel[]) {
  try {
    const home = os.homedir();
    const ollamaRoot = path.join(home, ".ollama", "models");
    const manifestsRoot = path.join(ollamaRoot, "manifests", "registry.ollama.ai");
    const blobsRoot = path.join(ollamaRoot, "blobs");
    if (!fs.existsSync(manifestsRoot)) return;

    const namespaces = fs.readdirSync(manifestsRoot, { withFileTypes: true });
    for (const ns of namespaces) {
      if (!ns.isDirectory()) continue;
      const nsDir = path.join(manifestsRoot, ns.name);
      const modelDirs = fs.readdirSync(nsDir, { withFileTypes: true });
      for (const mDir of modelDirs) {
        if (!mDir.isDirectory()) continue;
        const tagFiles = fs.readdirSync(path.join(nsDir, mDir.name), { withFileTypes: true });
        for (const tagFile of tagFiles) {
          if (!tagFile.isFile()) continue;
          const modelName =
            ns.name === "library"
              ? `${mDir.name}:${tagFile.name}`
              : `${ns.name}/${mDir.name}:${tagFile.name}`;
          if (seen.has(modelName)) continue;

          try {
            const manifestPath = path.join(nsDir, mDir.name, tagFile.name);
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
            let modelSize = 0;
            if (Array.isArray(manifest.layers)) {
              for (const layer of manifest.layers) {
                if (layer.mediaType?.includes("model") && typeof layer.size === "number") {
                  modelSize = layer.size;
                }
              }
            }
            let family = mDir.name.replace(/[^a-zA-Z0-9]/g, "");
            let paramSize = "4B";
            let quant = "Q4_K_M";
            const configDigest = manifest.config?.digest;
            if (typeof configDigest === "string") {
              const blobFile = path.join(blobsRoot, configDigest.replace(":", "-"));
              if (fs.existsSync(blobFile)) {
                const cfg = JSON.parse(fs.readFileSync(blobFile, "utf-8"));
                if (cfg.model_family) family = cfg.model_family;
                if (cfg.model_type) paramSize = cfg.model_type;
                if (cfg.file_type) quant = cfg.file_type;
              }
            }
            seen.add(modelName);
            out.push({
              name: modelName,
              model: modelName,
              size: modelSize || 2147483648,
              details: {
                family,
                parameter_size: paramSize,
                quantization_level: quant,
                context_length: 32768,
                source: "Ollama",
              },
            });
          } catch {
            // skip unreadable manifest
          }
        }
      }
    }
  } catch {
    // ignore fs errors
  }
}

function scanLocalGgufDirs(seen: Set<string>, out: DiscoveredModel[]) {
  const home = os.homedir();
  const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const candidateDirs = [
    { dir: path.join(appData, "Jan", "data", "llamacpp", "models"), source: "Jan Local" },
    { dir: path.join(home, "jan", "models"), source: "Jan Local" },
    { dir: path.join(home, ".lmstudio", "models"), source: "LM Studio" },
    { dir: path.join(home, ".cache", "lm-studio", "models"), source: "LM Studio" },
    { dir: path.join(appData, "Sanctum", "models"), source: "Sanctum Local" },
  ];

  const walkGguf = (dirPath: string, source: string, depth = 0) => {
    if (depth > 3 || !fs.existsSync(dirPath)) return;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          walkGguf(full, source, depth + 1);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".gguf")) {
          const stat = fs.statSync(full);
          // Skip tiny synthetic test stubs (< 1MB) in real directories
          if (stat.size < 1024 * 1024) continue;
          const parentName = path.basename(path.dirname(full));
          const displayName =
            entry.name.toLowerCase() === "model.gguf" && parentName !== "models"
              ? parentName
              : entry.name.replace(/\.gguf$/i, "");
          if (seen.has(displayName)) continue;

          const paramMatch = displayName.match(/(\d+(?:\.\d+)?[bBmM])/);
          const quantMatch = displayName.match(/(Q\d_[A-Z0-9_]+|F16|FP16|BF16)/i);
          seen.add(displayName);
          out.push({
            name: displayName,
            model: displayName,
            size: stat.size,
            details: {
              family: source,
              parameter_size: paramMatch ? paramMatch[1].toUpperCase() : `${(stat.size / 1e9).toFixed(1)}GB`,
              quantization_level: quantMatch ? quantMatch[1].toUpperCase() : "Q4_K_M",
              context_length: 32768,
              source,
            },
          });
        }
      }
    } catch {
      // ignore permission errors
    }
  };

  for (const c of candidateDirs) {
    walkGguf(c.dir, c.source);
  }
}

export async function GET() {
  const seen = new Set<string>();
  const models: DiscoveredModel[] = [];
  let online = false;
  let activeEndpoint = DEFAULT_OLLAMA_ENDPOINT;

  const endpoints = [DEFAULT_OLLAMA_ENDPOINT, "http://localhost:11434"];
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${ep}/api/tags`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = await res.json();
        online = true;
        activeEndpoint = ep;
        if (Array.isArray(data.models)) {
          for (const m of data.models) {
            const name = m.name || m.model;
            if (name && !seen.has(name)) {
              seen.add(name);
              models.push(m);
            }
          }
        }
        break;
      }
    } catch {
      // try next
    }
  }

  const discoveredFiles: DiscoveredModel[] = [];
  scanOllamaManifestsOnDisk(seen, discoveredFiles);
  scanLocalGgufDirs(seen, discoveredFiles);

  return NextResponse.json({
    online,
    endpoint: activeEndpoint,
    models,
    discoveredFiles,
  });
}
