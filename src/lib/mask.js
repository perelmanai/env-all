/**
 * Mask a secret for display: first 2 and last 3 characters, or all stars when short.
 */
export function maskValue(value) {
  if (value.length <= 4) return '****';
  const start = value.slice(0, 2);
  const end = value.slice(-3);
  return `${start}...${end}`;
}
