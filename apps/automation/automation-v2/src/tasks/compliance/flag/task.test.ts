import { expect, test } from 'vitest';
import { decodeFunctionData, getAddress } from 'viem';
import { ABI as ComplianceCheckAbi } from '@/abi/IComplianceCheck';
import { lcAddress } from '../shared';
import { setFlaggedData } from './task';

test('setFlagged calldata only ever flags: its second argument is true', () => {
  const batch = [
    lcAddress('0x00000000000000000000000000000000000000aa'),
    lcAddress('0x00000000000000000000000000000000000000bb'),
  ];
  const { functionName, args } = decodeFunctionData({
    abi: ComplianceCheckAbi,
    data: setFlaggedData(batch),
  });
  expect(functionName).toBe('setFlagged');
  expect(args).toEqual([batch.map((a) => getAddress(a)), true]);
});
