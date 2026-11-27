import type { Finding } from '../attention';
import type { LCAddress } from '../shared';

/**
 * Everything a flagger-check run touches. The task builds it from Overlord
 * and viem; tests build it from plain data.
 */
export interface FlaggerCheckContext {
  /** The Bot: the address of the Deployment's signer. */
  readBotAddress(): Promise<LCAddress>;
  /** Whether `bot` holds the Flagger role on the ComplianceCheck, at head. */
  isFlagger(bot: LCAddress): Promise<boolean>;
}

/** What a BotNotFlagger summary names besides the Bot. */
export interface FlaggerCheckConfig {
  complianceCheck: LCAddress;
  chainName: string;
}

/** A flagger-check run posts no Notices: a missing role needs a human. */
export interface FlaggerCheckRun {
  findings: Finding[];
  notices: never[];
}

/**
 * One check that the Bot is a Flagger on the Deployment's ComplianceCheck.
 * Not a Flagger raises BotNotFlagger; a Flagger raises nothing, which
 * resolves an open one.
 */
export async function runFlaggerCheck(
  ctx: FlaggerCheckContext,
  config: FlaggerCheckConfig
): Promise<FlaggerCheckRun> {
  const bot = await ctx.readBotAddress();
  if (await ctx.isFlagger(bot)) return { findings: [], notices: [] };
  return {
    findings: [
      {
        kind: 'BotNotFlagger',
        key: '',
        summary: `the Bot ${bot} is not a Flagger on ComplianceCheck ${config.complianceCheck} (${config.chainName})`,
      },
    ],
    notices: [],
  };
}
