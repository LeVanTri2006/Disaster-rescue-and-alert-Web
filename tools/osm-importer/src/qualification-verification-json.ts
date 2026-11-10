import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { isObject } from './qualification-validation';

export const rawSha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');
/** Canonical JSON for new signed envelopes/configuration only, NOT geometry V3.
 * JSON primitives; sorted object keys; finite numbers; no undefined/holes,
 * non-plain objects, accessors or cyclic references. Exact UTF-8 bytes are signed.
 */
export function canonicalJson(
  value: unknown,
  ancestors = new Set<object>(),
): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('NON_FINITE_JSON_NUMBER');
    return JSON.stringify(value === 0 ? 0 : value);
  }
  if (!value || typeof value !== 'object')
    throw new Error('INVALID_JSON_VALUE');
  if (ancestors.has(value)) throw new Error('CYCLIC_JSON');
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null)
    throw new Error('NON_PLAIN_JSON_OBJECT');
  const next = new Set(ancestors).add(value);
  for (const descriptor of Object.values(
    Object.getOwnPropertyDescriptors(value),
  ))
    if (descriptor.get || descriptor.set)
      throw new Error('JSON_ACCESSOR_FORBIDDEN');
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (let i = 0; i < value.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(value, i))
        throw new Error('SPARSE_JSON_ARRAY');
      items.push(canonicalJson(value[i], next));
    }
    return `[${items.join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key], next)}`,
    )
    .join(',')}}`;
}
export function parseJsonBytes(
  bytes: Uint8Array,
  requireCanonical = false,
): unknown {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const parsed: unknown = JSON.parse(text);
  if (
    requireCanonical &&
    !Buffer.from(canonicalJson(parsed), 'utf8').equals(Buffer.from(bytes))
  )
    throw new Error('NON_CANONICAL_SIGNED_JSON');
  return parsed;
}
export function immutableJson<T>(value: T): T {
  if (Array.isArray(value) || isObject(value)) {
    for (const child of Object.values(value)) immutableJson(child);
    Object.freeze(value);
  }
  return value;
}
export function strictBase64(value: unknown): Buffer | undefined {
  if (
    typeof value !== 'string' ||
    !value.length ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    return undefined;
  const bytes = Buffer.from(value, 'base64');
  return bytes.toString('base64') === value ? bytes : undefined;
}
