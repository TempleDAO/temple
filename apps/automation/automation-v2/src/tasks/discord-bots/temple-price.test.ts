import { assert, test } from 'vitest';
import {
  computeTemplePricePremium,
  formatTemplePriceSidebarState,
} from './temple-price';

test('formats Temple price sidebar state', () => {
  const state = formatTemplePriceSidebarState({
    spotPrice: 3.4567,
    tpi: 2.34567,
  });

  assert.equal(computeTemplePricePremium(3.4567, 2.34567).toFixed(2), '1.47');
  assert.equal(state.nickname, '$3.457 | 1.47x TPI');
  assert.equal(state.activity.name, 'TPI rise: $2.3457');
});
