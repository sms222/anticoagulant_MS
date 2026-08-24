/**
 * Rosendaal method for Time in Therapeutic Range (TTR).
 * Reference: Rosendaal FR et al., Thromb Haemost 1993.
 *
 * Linearly interpolates a daily INR value between consecutive measured
 * INRs, then computes the fraction of interpolated days that fall within
 * [targetLow, targetHigh].
 */

export interface InrReading {
  date: Date;
  value: number;
}

export interface RosendaalResult {
  ttrPercent: number;
  totalDays: number;
  daysInRange: number;
}

export function calculateRosendaalTTR(
  readings: InrReading[],
  targetLow: number,
  targetHigh: number
): RosendaalResult {
  if (readings.length < 2) {
    return { ttrPercent: 0, totalDays: 0, daysInRange: 0 };
  }

  const sorted = [...readings].sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalDays = 0;
  let daysInRange = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];

    const dayCount = Math.round(
      (end.date.getTime() - start.date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dayCount <= 0) continue;

    for (let d = 0; d < dayCount; d++) {
      // Linear interpolation between start.value and end.value
      const fraction = d / dayCount;
      const interpolatedInr = start.value + (end.value - start.value) * fraction;

      totalDays++;
      if (interpolatedInr >= targetLow && interpolatedInr <= targetHigh) {
        daysInRange++;
      }
    }
  }

  const ttrPercent = totalDays > 0 ? (daysInRange / totalDays) * 100 : 0;

  return { ttrPercent, totalDays, daysInRange };
}

/**
 * Percentage of actual INR readings (not interpolated days) within range.
 * Distinct metric from TTR, per clinic requirement (PINRR).
 */
export function calculatePINRR(
  readings: InrReading[],
  targetLow: number,
  targetHigh: number
): number {
  if (readings.length === 0) return 0;
  const inRange = readings.filter(
    (r) => r.value >= targetLow && r.value <= targetHigh
  ).length;
  return (inRange / readings.length) * 100;
}
