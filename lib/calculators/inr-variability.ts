import type { InrReading } from "./rosendaal";

export interface VariabilityResult {
  mean: number;
  standardDeviation: number;
  coefficientOfVariation: number; // SD / mean, expressed as %
  n: number;
}

/**
 * INR variability using sample standard deviation of measured INR values.
 * Requires at least 2 readings.
 */
export function calculateInrVariability(readings: InrReading[]): VariabilityResult {
  const values = readings.map((r) => r.value);
  const n = values.length;

  if (n < 2) {
    return { mean: values[0] ?? 0, standardDeviation: 0, coefficientOfVariation: 0, n };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const sumSquaredDiffs = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  const standardDeviation = Math.sqrt(sumSquaredDiffs / (n - 1)); // sample SD

  const coefficientOfVariation = mean !== 0 ? (standardDeviation / mean) * 100 : 0;

  return { mean, standardDeviation, coefficientOfVariation, n };
}

/**
 * Extreme-value rate: fraction of readings below `lowCutoff` or above `highCutoff`.
 * Defaults (INR < 1.5 or > 5.0) are common clinical thresholds — confirm against
 * your own protocol before relying on these for quality reporting.
 */
export function calculateExtremeValueRate(
  readings: InrReading[],
  lowCutoff = 1.5,
  highCutoff = 5.0
): number {
  if (readings.length === 0) return 0;
  const extreme = readings.filter((r) => r.value < lowCutoff || r.value > highCutoff).length;
  return (extreme / readings.length) * 100;
}
