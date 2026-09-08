import type { CallNetworkStatus } from "@/lib/calls/config";

export type QualityStep = "full" | "reduced" | "low" | "paused";

export function mapConnectionQuality(quality: string): CallNetworkStatus {
  if (quality === "lost" || quality === "reconnecting") return "reconnecting";
  if (quality === "poor") return "weak";
  return "good";
}

export function nextQualityStep(current: QualityStep, network: CallNetworkStatus): QualityStep {
  if (network === "good") {
    if (current === "paused") return "low";
    if (current === "low") return "reduced";
    return "full";
  }
  if (network === "reconnecting") return current === "full" ? "reduced" : current;
  if (current === "full") return "reduced";
  if (current === "reduced") return "low";
  return "paused";
}

export function qualityCopy(network: CallNetworkStatus, videoPaused: boolean) {
  if (network === "reconnecting") return "Reconnecting…";
  if (videoPaused || network === "weak") {
    return "Connection is weak — keeping audio connected.";
  }
  return "Good";
}
