export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function mapRange(v: number, a1: number, a2: number, b1: number, b2: number): number {
  return b1 + (v - a1) * (b2 - b1) / (a2 - a1);
}

export function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function degToRad(d: number): number { return d * Math.PI / 180; }
export function radToDeg(r: number): number { return r * 180 / Math.PI; }

export function formatNumber(n: number, decimals = 1, locale = 'en-US'): string {
  return n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPower(kW: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') return `${formatNumber(kW * 1.34102)} hp`;
  return `${formatNumber(kW)} kW`;
}

export function formatTorque(Nm: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') return `${formatNumber(Nm * 0.73756)} lb-ft`;
  return `${formatNumber(Nm)} Nm`;
}

export function formatPressure(bar: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') return `${formatNumber(bar * 14.5038)} psi`;
  return `${formatNumber(bar, 2)} bar`;
}

export function formatTemp(c: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') return `${formatNumber(c * 9/5 + 32)} °F`;
  return `${formatNumber(c)} °C`;
}