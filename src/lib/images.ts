/**
 * Requests a reasonably sized source image from hosts that support resizing,
 * so the Next.js optimizer doesn't download multi-megabyte originals.
 */
export function sourceImageUrl(url: string, width = 1600) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "images.unsplash.com" && !parsed.search) {
      parsed.search = new URLSearchParams({
        auto: "format",
        fit: "crop",
        w: String(width),
        q: "80",
      }).toString();
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const GRADIENTS = [
  "from-orange-500 to-yellow-300",
  "from-sky-500 to-blue-700",
  "from-emerald-400 to-green-700",
  "from-rose-400 to-red-600",
  "from-violet-400 to-purple-700",
  "from-amber-400 to-orange-600",
];

/** Stable gradient for items without a cover photo. */
export function gradientFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return `bg-gradient-to-br ${GRADIENTS[Math.abs(hash) % GRADIENTS.length]}`;
}
