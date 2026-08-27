import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleForPath } from './favicon';

test('maps CaledoraOS routes to their module favicon', () => {
  assert.equal(moduleForPath('/'), 'hub');
  assert.equal(moduleForPath('/wiki'), 'hub');
  assert.equal(moduleForPath('/page/123'), 'hub');
  assert.equal(moduleForPath('/oria'), 'bank');
  assert.equal(moduleForPath('/instagram'), 'instagram');
  assert.equal(moduleForPath('/twitter/profile/%40UniversaLacora'), 'twitter');
  assert.equal(moduleForPath('/airways/destinations'), 'airways');
});