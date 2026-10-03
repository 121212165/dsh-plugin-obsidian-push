import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseVaultRegistry, pickVault } from '../src/vault.ts';

test('pickVault prefers the open vault, then the newest', () => {
  assert.equal(pickVault([{ path: 'C:/vaults/A', ts: 100 }, { path: 'C:/vaults/B', open: true, ts: 50 }]), 'C:/vaults/B');
  assert.equal(pickVault([{ path: 'C:/vaults/A', ts: 100 }, { path: 'C:/vaults/B', ts: 50 }]), 'C:/vaults/A');
  assert.equal(pickVault([]), null);
  assert.equal(pickVault([{ path: '   ' }]), null);
});

test("parseVaultRegistry reads Obsidian's real registry shape and tolerates garbage", () => {
  const raw = JSON.stringify({
    vaults: {
      a: { path: 'C:/Users/x/Obsidian Vault', open: true, ts: 1790642053502 },
      b: { path: 'C:/Users/x/Obsidian', ts: 1790516475408 },
    },
  });
  const parsed = parseVaultRegistry(raw);
  assert.equal(parsed.length, 2);
  assert.equal(pickVault(parsed), 'C:/Users/x/Obsidian Vault');
  assert.deepEqual(parseVaultRegistry('not json'), []);
  assert.deepEqual(parseVaultRegistry('{}'), []);
});
