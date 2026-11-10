import { GeoPoint } from './types';

const EARTH_RADIUS_METERS = 6371000.0;

export function haversineDistanceMeters(p1: GeoPoint, p2: GeoPoint): number {
  if (p1.lat === p2.lat && p1.lon === p2.lon) {
    return 0.0;
  }
  const lat1Rad = (p1.lat * Math.PI) / 180.0;
  const lat2Rad = (p2.lat * Math.PI) / 180.0;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180.0;
  const dLon = ((p2.lon - p1.lon) * Math.PI) / 180.0;

  const sinDLat2 = Math.sin(dLat / 2.0);
  const sinDLon2 = Math.sin(dLon / 2.0);

  const a =
    sinDLat2 * sinDLat2 +
    sinDLon2 * sinDLon2 * Math.cos(lat1Rad) * Math.cos(lat2Rad);

  const clampedA = Math.max(0.0, Math.min(1.0, a));
  const c = 2.0 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1.0 - clampedA));

  return EARTH_RADIUS_METERS * c;
}

export function calculatePolylineLengthMeters(geometry: GeoPoint[]): number {
  if (geometry.length < 2) return 0.0;
  let total = 0.0;
  for (let i = 0; i < geometry.length - 1; i++) {
    total += haversineDistanceMeters(geometry[i], geometry[i + 1]);
  }
  return total;
}
