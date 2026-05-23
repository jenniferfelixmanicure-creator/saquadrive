export const RIDE_PRICES: Record<string, number> = {
  moto: 1.20,
  basico: 1.70,
  intermediario: 2.20,
  vip: 3.90,
};

export const BASE_FEE = 5.5;
export const MIN_FARE = 10;

export const PEAK_HOURS: { start: number; end: number }[] = [
  { start: 7, end: 9 },
  { start: 17, end: 19 },
];

export const LATE_CANCEL_FEE = 7.50;
export const WAIT_FREE_MINUTES = 2;
export const WAIT_FEE_PER_MIN = 0.30;

export function isPeakHour(hour: number): boolean {
  return PEAK_HOURS.some((p) => hour >= p.start && hour <= p.end);
}

export function getSurgeMultiplier(hour: number): number {
  return isPeakHour(hour) ? 1.5 : 1.0;
}

export function calculateFare(
  distanceKm: number,
  rideType: string,
  surgeMultiplier = 1.0
): number {
  const perKm = RIDE_PRICES[rideType] ?? 1.70;
  const raw = Math.round((BASE_FEE + distanceKm * perKm) * surgeMultiplier * 100) / 100;
  return Math.max(raw, MIN_FARE);
}

export function getDriverCategory(vehicleYear: number): "basico" | "intermediario" | "vip" {
  if (vehicleYear >= 2020) return "vip";
  if (vehicleYear >= 2011) return "intermediario";
  return "basico";
}

export function canDriverHandleRide(
  vehicleType: "car" | "moto",
  vehicleYear: number,
  rideType: string
): boolean {
  if (rideType === "moto") return vehicleType === "moto";
  if (vehicleType !== "car") return false;
  const category = getDriverCategory(vehicleYear);
  if (category === "vip") return true;
  if (category === "intermediario") return rideType !== "vip";
  return rideType === "basico";
}
