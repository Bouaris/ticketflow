/**
 * Utility Functions
 *
 * Shared helper functions used across the application.
 */

// ============================================================
// COLOR UTILITIES
// ============================================================

/**
 * Convert hex color to rgba with alpha transparency.
 * Supports both #RGB and #RRGGBB formats.
 *
 * @param hex Hex color string (e.g., "#ff0000" or "#f00")
 * @param alpha Opacity value between 0 and 1
 * @returns RGBA color string (e.g., "rgba(255, 0, 0, 0.5)")
 */
export function hexToRgba(hex: string, alpha: number): string {
  let r = 0, g = 0, b = 0;

  if (hex.length === 4) {
    // Short format: #RGB
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    // Long format: #RRGGBB
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
