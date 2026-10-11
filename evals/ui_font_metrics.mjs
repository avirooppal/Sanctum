/** Pixel metric shared with the browser; no comparison thresholds are hidden here. */
export function changedPixelFraction(left, right) {
  if (!left.length || left.length !== right.length || left.length % 4 !== 0) {
    throw new Error('Expected equal nonempty RGBA rasters');
  }
  for (const raster of [left,right]) {
    for (const channel of raster) {
      if (!Number.isInteger(channel) || channel < 0 || channel > 255) {
        throw new Error('RGBA channels must be integers in 0..255');
      }
    }
  }
  let changed = 0;
  for (let i = 0; i < left.length; i += 4) {
    if (left[i] !== right[i] || left[i+1] !== right[i+1] ||
        left[i+2] !== right[i+2] || left[i+3] !== right[i+3]) changed++;
  }
  return changed / (left.length / 4);
}
