import { expect, test } from 'vitest';
import { chooseExemptions } from './plan';

const OLD = {
  '0x00000000000000000000000000000000000000aa': 'exempt before the rename',
};
const NEW = {
  '0x00000000000000000000000000000000000000bb': 'exempt after the rename',
};

test('Exemptions set only under the old name, compliance_exempt, still apply', () => {
  expect(chooseExemptions(undefined, OLD)).toEqual(OLD);
});

test('compliance_exemptions wins when the old name is unset or holds the same value', () => {
  expect(chooseExemptions(NEW, undefined)).toEqual(NEW);
  expect(chooseExemptions(NEW, { ...NEW })).toEqual(NEW);
  expect(chooseExemptions(undefined, undefined)).toBeUndefined();
});

test('both names set with different values fails the run instead of guessing', () => {
  expect(() => chooseExemptions(NEW, OLD)).toThrow(/both set and differ/);
  expect(() => chooseExemptions(null, OLD)).toThrow(/both set and differ/);
});
