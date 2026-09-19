import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFixedNumber, formatNumber } from './formatters.js';

test('formatters cap displayed precision and handle unavailable values', () => {
  assert.equal(formatNumber(67.084463848), '67.08');
  assert.equal(formatNumber(24.775725), '24.78');
  assert.equal(formatNumber(67.41553556889815), '67.42');
  assert.equal(formatFixedNumber(24.49999941694322, 2), '24.50');
  assert.equal(formatNumber(111.3), '111.3');
  assert.equal(formatNumber(120), '120');
  assert.equal(formatNumber(null), '—');
  assert.equal(formatNumber(undefined), '—');
  assert.equal(formatNumber(Number.NaN), '—');
  assert.equal(formatNumber(Number.POSITIVE_INFINITY), '—');
  assert.equal(formatNumber('43.868477999'), '43.87');
});
