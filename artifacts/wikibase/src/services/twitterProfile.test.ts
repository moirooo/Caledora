import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeTwitterRouteHandle,
  formatTwitterCount,
  isTwitterHandleTaken,
  normalizeTwitterHandle,
} from './twitterProfile';

test('normalizes handles without turning an empty pseudo into a usable account', () => {
  assert.equal(normalizeTwitterHandle(' @Caledora_FC '), '@Caledora_FC');
  assert.equal(normalizeTwitterHandle('@@Caledora-FC'), '@CaledoraFC');
  assert.equal(normalizeTwitterHandle('@---'), null);
});

test('turns malformed profile route parameters into a safe not-found value', () => {
  assert.equal(decodeTwitterRouteHandle('%40Caledora_FC'), '@Caledora_FC');
  assert.equal(decodeTwitterRouteHandle('not%valid'), null);
  assert.equal(decodeTwitterRouteHandle(null), null);
});

test('recognizes reserved handles while allowing the current profile to keep its handle', () => {
  const reserved = ['@CaledoraSport', '@Caledora_FC'];
  assert.equal(isTwitterHandleTaken('@CaledoraSport', '@Author', reserved), true);
  assert.equal(isTwitterHandleTaken('@caledora_fc', '@Caledora_FC', reserved), false);
});

test('formats large engagement and follower counts with compact Twitter units', () => {
  assert.equal(formatTwitterCount(999), '999');
  assert.equal(formatTwitterCount(1_000), '1K');
  assert.equal(formatTwitterCount(1_500), '1.5K');
  assert.equal(formatTwitterCount(247_276.2), '247.2K');
  assert.equal(formatTwitterCount(1_250_000), '1.2M');
  assert.equal(formatTwitterCount(2_000_000), '2M');
});