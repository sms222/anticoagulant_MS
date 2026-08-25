/**
 * Rosendaal method for Time in Therapeutic Range (TTR).
 * Reference: Rosendaal FR et al., Thromb Haemost 1993.
 *
 * Linearly interpolates a daily INR value between consecutive measured
 * INRs, then computes the fraction of interpolated days that fall within
 * the target range in force on that day.
 *
 * The target range can change over a patient's course (reviewed at a later
 * visit), so this takes a list of time-bound ranges rather than one fixed
 * range — each interpolated day is checked against whichever range was
 * effective on that date.
 */

export interface InrReading {
  date: Date;
  value: number;
}

export interface TargetRangePeriod {
  from: Date;
  low: number;
  high: number;
}

export interface RosendaalResult {
  ttrPercent: number;
  totalDays: number;
  daysInRange: number;
}

/** Finds the range in force on `date`: the latest period with from <= date. */
export function resolveRangeForDate(
  ranges: TargetRangePeriod[],
  date: Date
): { low: number; high: number } | null {
  if (ranges.length === 0) return null;
  const sorted = [...ranges].sort((a, b) => a.from.getTime() - b.from.getTime());
  let applicable = sorted[0];
  for (const r of sorted) {
    if (r.from.getTime() <= date.getTime()) applicable = r;
    else break;
  }
  return { low: applicable.low, high: applicable.high };
}

export function calculateRosendaalTTR(
  readings: InrReading[],
  ranges: TargetRangePeriod[]
): RosendaalResult {
  if (readings.length < 2 || ranges.length === 0) {
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
      const dayDate = new Date(start.date.getTime() + d * 24 * 60 * 60 * 1000);
      const range = resolveRangeForDate(ranges, dayDate);
      if (!range) continue;

      totalDays++;
      if (interpolatedInr >= range.low && interpolatedInr <= range.high) {
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
export function calculatePINRR(readings: InrReading[], ranges: TargetRangePeriod[]): number {
  if (readings.length === 0 || ranges.length === 0) return 0;
  const inRange = readings.filter((r) => {
    const range = resolveRangeForDate(ranges, r.date);
    return range && r.value >= range.low && r.value <= range.high;
  }).length;
  return (inRange / readings.length) * 100;
}
