export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  const rounded = Number(Number(value).toFixed(Math.min(2, Math.max(0, decimals))));
  return String(rounded);
}

export function formatFixedNumber(value, decimals = 2) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'â€”';
  return Number(value).toFixed(Math.min(2, Math.max(0, decimals)));
}

export function formatPower(value) {
  return formatNumber(value, 2);
}

export function formatEnergy(value) {
  return formatNumber(value, 2);
}

export function formatPercent(value) {
  return formatNumber(value, 2);
}

export function formatDistance(value) {
  return formatNumber(value, 2);
}

export function formatCurrency(value, currency = '₹') {
  const formatted = formatNumber(value, 2);
  return formatted === '—' ? formatted : `${currency}${formatted}`;
}

export function formatTemperature(value) {
  return formatNumber(value, 2);
}
