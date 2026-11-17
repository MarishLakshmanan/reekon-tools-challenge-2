import type { MeasurementUnit, Unassigned } from "./types";

export const UNASSIGNED: Unassigned = { pathId: null, startAnchorId: null, endAnchorId: null };

export const UNITS: MeasurementUnit[] = ["mm", "cm", "m", "in", "ft"];

/** Range of the random values the Add Measurement button generates, per unit. */
const RANDOM_RANGES: Record<MeasurementUnit, { min: number; max: number }> = {
  mm: { min: 10, max: 1000 },
  cm: { min: 1, max: 100 },
  m: { min: 0.1, max: 10 },
  in: { min: 1, max: 48 },
  ft: { min: 1, max: 20 },
};

/** A random value in `unit`'s range, rounded to one decimal. `rand` returns a number in [0, 1). */
export function randomValue(unit: MeasurementUnit, rand: () => number = Math.random): number {
  const { min, max } = RANDOM_RANGES[unit];
  return Math.round((min + rand() * (max - min)) * 10) / 10;
}

export function formatMeasurement(value: number, unit: MeasurementUnit): string {
  "worklet";
  return `${value} ${unit}`;
}
