// Detect Android native (Capacitor) and toggle low-perf CSS mode.
// Low-perf mode downgrades backdrop-blur, disables non-essential infinite
// animations, and respects prefers-reduced-motion. Web browsers stay full.

import { Capacitor } from "@capacitor/core";

export const isAndroidNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
};

export const isLowEndDevice = (): boolean => {
  // 4 cores or less, or <= 4GB RAM => treat as low end
  const cores = (navigator as any).hardwareConcurrency ?? 8;
  const mem = (navigator as any).deviceMemory ?? 8;
  return cores <= 4 || mem <= 4;
};

export const applyPlatformPerfMode = () => {
  const root = document.documentElement;

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const lowPerf = isAndroidNative() || isLowEndDevice() || prefersReduced;

  if (lowPerf) {
    root.setAttribute("data-perf", "low");
  } else {
    root.setAttribute("data-perf", "high");
  }

  if (prefersReduced) {
    root.setAttribute("data-motion", "reduced");
  }
};
