/**
 * Hardware Detection & VRAM Fit Estimator (Core AI Layer)
 * Determines whether a model can run fully on GPU or requires CPU offloading.
 */

export interface ModelFitEstimate {
  canFitFullVRAM: boolean;
  recommendedGpuLayers: number;
  estimatedVramRequiredGB: number;
  offloadRatio: number;
}

export function estimateModelFit(
  fileSizeGB: number,
  availableVramGB: number,
  maxLayers: number = 64
): ModelFitEstimate {
  const estimatedVramRequiredGB = Number((fileSizeGB * 1.15).toFixed(1));
  const canFitFullVRAM = availableVramGB >= estimatedVramRequiredGB;

  let offloadRatio = 1.0;
  let recommendedGpuLayers = maxLayers;

  if (!canFitFullVRAM && availableVramGB > 0) {
    offloadRatio = Number((availableVramGB / estimatedVramRequiredGB).toFixed(2));
    recommendedGpuLayers = Math.max(0, Math.floor(maxLayers * offloadRatio));
  } else if (availableVramGB === 0) {
    offloadRatio = 0.0;
    recommendedGpuLayers = 0;
  }

  return {
    canFitFullVRAM,
    recommendedGpuLayers,
    estimatedVramRequiredGB,
    offloadRatio,
  };
}
