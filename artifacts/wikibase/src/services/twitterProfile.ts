export function normalizeTwitterHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const handle = value.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
  return handle ? `@${handle}` : null;
}

export function decodeTwitterRouteHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return normalizeTwitterHandle(decodeURIComponent(value));
  } catch {
    return null;
  }
}

export function isTwitterHandleTaken(nextHandle: string, currentHandle: string, takenHandles: string[]) {
  const next = nextHandle.toLowerCase();
  const current = currentHandle.toLowerCase();
  return takenHandles.some(handle => handle.toLowerCase() === next && handle.toLowerCase() !== current);
}

export function formatTwitterCount(value: number) {
  if (!Number.isFinite(value)) return '0';
  const count = Math.max(0, value);
  if (count >= 1_000_000) {
    const millions = Math.floor((count / 1_000_000) * 10) / 10;
    return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (count >= 1_000) {
    const thousands = Math.floor((count / 1_000) * 10) / 10;
    return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}K`;
  }
  return String(Math.round(count));
}