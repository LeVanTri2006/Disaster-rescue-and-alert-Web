/** V2: length-prefixed ASCII node IDs and decimal Half-Even quantization.
 * number semantics: the exact decimal value of Number.toString() (including
 * scientific notation), NOT the exact binary64 fraction and NOT x * 1e7.
 * No reverse operation: geometry is already directed by the importer.
 */
import * as crypto from 'crypto';
import { RoadEdge } from './types';
import { GEOMETRY_HASH_VERSION } from './qualification-types';

export class CanonicalGeometryError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'CanonicalGeometryError';
  }
}

function fail(code: string, message: string): never {
  throw new CanonicalGeometryError(code, message);
}

export function formatCoordinate(coord: unknown, type: 'lat' | 'lon' = 'lat'): string {
  if (typeof coord !== 'number' || !Number.isFinite(coord)) {
    fail('INVALID_COORDINATE_VALUE', 'Coordinate must be finite');
  }
  if (type !== 'lat' && type !== 'lon') fail('INVALID_COORDINATE_TYPE', 'Expected lat/lon');
  const bound = type === 'lat' ? 90 : 180;
  if (Math.abs(coord) > bound) fail(`WGS84_${type === 'lat' ? 'LATITUDE' : 'LONGITUDE'}_OUT_OF_BOUNDS`, 'Outside WGS84');
  const [mantissa, exponent = '0'] = Math.abs(coord).toString().toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const digits = BigInt(whole + fraction);
  const power = 7 + Number(exponent) - fraction.length;
  let scaled: bigint;
  if (power >= 0) scaled = digits * 10n ** BigInt(power);
  else {
    const denominator = 10n ** BigInt(-power);
    scaled = digits / denominator;
    const remainder = digits % denominator;
    if (remainder * 2n > denominator || (remainder * 2n === denominator && scaled % 2n !== 0n)) scaled++;
  }
  const sign = coord < 0 && scaled !== 0n ? '-' : '';
  return `${sign}${scaled / 10000000n}.${(scaled % 10000000n).toString().padStart(7, '0')}`;
}

export type EdgeGeometryParams = Pick<RoadEdge, 'fromNodeId' | 'toNodeId' | 'isWayForward' | 'geometry'>;

function validateIdentity(edge: unknown): asserts edge is EdgeGeometryParams {
  if (!edge || typeof edge !== 'object' || Array.isArray(edge)) fail('INVALID_EDGE_IDENTITY', 'Expected edge object');
  const e = edge as Record<string, unknown>;
  if (typeof e.fromNodeId !== 'string' || typeof e.toNodeId !== 'string' ||
      !/^[A-Za-z0-9_]+$/.test(e.fromNodeId) || !/^[A-Za-z0-9_]+$/.test(e.toNodeId)) fail('INVALID_EDGE_IDENTITY', 'Expected ASCII alphanumeric/underscore node IDs');
  if (typeof e.isWayForward !== 'boolean') fail('INVALID_EDGE_DIRECTION', 'Direction must be a boolean');
  validateEdgeGeometry(e.geometry);
}

export function validateEdgeGeometry(geometry: unknown): void {
  if (!Array.isArray(geometry) || geometry.length < 2) fail('DEGENERATE_GEOMETRY_ERROR', 'Need at least two vertices');
  const quantized = geometry.map((pt: unknown) => {
    if (!pt || typeof pt !== 'object' || !('lat' in pt) || !('lon' in pt)) fail('INVALID_COORDINATE_VALUE', 'Malformed vertex');
    return `${formatCoordinate(pt.lat, 'lat')},${formatCoordinate(pt.lon, 'lon')}`;
  });
  if (quantized.every(pt => pt === quantized[0])) fail('DEGENERATE_GEOMETRY_ERROR', 'Zero length after quantization');
}

export function buildCanonicalGeometryString(edge: unknown): string {
  validateIdentity(edge);
  const polyline = edge.geometry.map(pt => `${formatCoordinate(pt.lat, 'lat')},${formatCoordinate(pt.lon, 'lon')}`).join(';');
  return `${GEOMETRY_HASH_VERSION}|EDGE:${edge.fromNodeId.length}:${edge.fromNodeId}->${edge.toNodeId.length}:${edge.toNodeId}|FWD:${edge.isWayForward}|GEO:${polyline}`;
}

export function computeCanonicalEdgeGeometryHash(edge: unknown): string {
  return crypto.createHash('sha256').update(buildCanonicalGeometryString(edge), 'utf8').digest('hex');
}

/** Compatibility oracle only. Never used by the qualifier or evidence validator.
 * Preserves V1 toFixed semantics and the two historical SHA-256 fixtures.
 */
export function buildLegacyCanonicalGeometryString(edge: EdgeGeometryParams): string {
  validateIdentity(edge);
  const legacy = (n: number) => {
    const s = n.toFixed(7);
    return s === '-0.0000000' ? '0.0000000' : s;
  };
  return `EDGE:${edge.fromNodeId}->${edge.toNodeId}|FWD:${edge.isWayForward}|GEO:${edge.geometry.map(pt => `${legacy(pt.lat)},${legacy(pt.lon)}`).join(';')}`;
}
