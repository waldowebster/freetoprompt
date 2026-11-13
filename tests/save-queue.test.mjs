import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveQueue } from '../mobile/save-queue.mjs';

test('rapid edits are serialized and a reset cannot be overwritten by an older draft', async () => {
  const writes = [];
  const queue = createSaveQueue(value => new Promise(resolve => writes.push({ value, resolve })));
  const first = queue.save('first draft');
  const second = queue.save('second draft');
  const reset = queue.save('');
  assert.deepEqual(writes.map(w => w.value), ['first draft']);
  writes[0].resolve();
  await first;
  assert.deepEqual(writes.map(w => w.value), ['first draft', '']);
  writes[1].resolve();
  await Promise.all([second, reset]);
});

test('a failed native write reports failure without poisoning subsequent saves', async () => {
  let fail = true;
  const writes = [];
  const queue = createSaveQueue(async value => {
    if (fail) { fail = false; throw Error('disk unavailable'); }
    writes.push(value);
  });
  await assert.rejects(queue.save('failed'), /disk unavailable/);
  await queue.save('recovered');
  assert.deepEqual(writes, ['recovered']);
});
