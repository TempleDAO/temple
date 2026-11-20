import { expect, test } from 'vitest';
import { LCAddress, lcAddress } from '../shared';
import {
  FlaggerCheckConfig,
  FlaggerCheckContext,
  runFlaggerCheck,
} from './run';

const BOT = lcAddress('0x00000000000000000000000000000000000000b0');

const config: FlaggerCheckConfig = {
  complianceCheck: lcAddress('0x00000000000000000000000000000000000000cc'),
  chainName: 'Sepolia',
};

/** A ComplianceCheck whose Flaggers are `flaggers`, read by BOT. */
const chain = (flaggers: LCAddress[]): FlaggerCheckContext => ({
  readBotAddress: async () => BOT,
  isFlagger: async (account) => flaggers.includes(account),
});

test('a Bot that is not a Flagger raises BotNotFlagger naming it', async () => {
  const run = await runFlaggerCheck(chain([]), config);
  expect(run.findings).toEqual([
    {
      kind: 'BotNotFlagger',
      key: '',
      summary: expect.stringContaining(BOT),
    },
  ]);
  expect(run.findings[0].summary).toContain(config.complianceCheck);
  expect(run.notices).toEqual([]);
});

test('a Bot that is a Flagger raises nothing', async () => {
  expect(await runFlaggerCheck(chain([BOT]), config)).toEqual({
    findings: [],
    notices: [],
  });
});
