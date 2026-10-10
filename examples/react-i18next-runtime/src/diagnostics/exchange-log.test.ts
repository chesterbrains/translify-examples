import { describe, expect, it } from 'vitest';
import { pushCapped } from './exchange-log';

describe('pushCapped', () => {
  it('appends below the cap', () => {
    expect(pushCapped([1, 2], 3, 5)).toEqual([1, 2, 3]);
  });

  it('drops the oldest entry at the cap', () => {
    expect(pushCapped([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  it('does not mutate the input', () => {
    const input = [1, 2, 3];
    pushCapped(input, 4, 3);
    expect(input).toEqual([1, 2, 3]);
  });
});
