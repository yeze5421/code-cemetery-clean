import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveQueue } from '../src/services/save-queue';
test('saves execute in edit order and a rejected save does not block later changes', async () => {
  const calls: number[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queue = new SaveQueue<number>(async (value) => {
    calls.push(value);
    if (value === 1) await gate;
    if (value === 2) throw new Error('Temporary write failure');
  });
  const first = queue.enqueue(1);
  const second = queue.enqueue(2).catch((e) => e.message);
  const third = queue.enqueue(3);
  await Promise.resolve();
  assert.deepEqual(calls, [1]);
  release();
  await first;
  assert.equal(await second, 'Temporary write failure');
  await third;
  assert.deepEqual(calls, [1, 2, 3]);
});
