// Barangay San Isidro Hall (Depot center in Malolos, Bulacan)
export const BARANGAY_CENTER = {
  lat: 14.8433,
  lng: 120.8114,
  label: "Barangay San Isidro Hall (MRF Depot)",
};

export interface GeoStop {
  id?: number | string;
  lat: number;
  lng: number;
  [key: string]: unknown;
}

/**
 * Straight-line Haversine distance in kilometers.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Compute total straight-line distance across ordered stops.
 */
export function computeRouteDistanceKm(
  stops: Array<{ lat: number; lng: number }>,
  includeDepotStart = true
): number {
  if (stops.length === 0) return 0;
  let total = 0;
  if (includeDepotStart) {
    total += haversineKm(
      BARANGAY_CENTER.lat,
      BARANGAY_CENTER.lng,
      stops[0].lat,
      stops[0].lng
    );
  }
  for (let i = 1; i < stops.length; i++) {
    total += haversineKm(
      stops[i - 1].lat,
      stops[i - 1].lng,
      stops[i].lat,
      stops[i].lng
    );
  }
  return Math.round(total * 100) / 100;
}

/**
 * Nearest-neighbor suggested stop ordering starting from Barangay MRF Depot.
 */
export function suggestNearestNeighborOrder<T extends { lat: number; lng: number }>(
  stops: T[],
  startPoint: { lat: number; lng: number } = BARANGAY_CENTER
): { ordered: T[]; estimatedDistanceKm: number } {
  if (stops.length <= 1) {
    return {
      ordered: [...stops],
      estimatedDistanceKm: computeRouteDistanceKm(stops, true),
    };
  }

  const remaining = [...stops];
  const ordered: T[] = [];
  let current = { lat: startPoint.lat, lng: startPoint.lng };
  let totalKm = 0;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    totalKm += bestDist;
    current = { lat: next.lat, lng: next.lng };
  }

  return {
    ordered,
    estimatedDistanceKm: Math.round(totalKm * 100) / 100,
  };
}
