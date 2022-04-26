import { ethers, Signer } from 'ethers';
import { JsonRpcSigner } from '@ethersproject/providers';

import { formatNumber } from 'utils/formatter';
import {
  EXIT_QUEUE_ADDRESS,
  ACCELERATED_EXIT_QUEUE_ADDRESS,
} from 'providers/env';
import { Nullable } from 'types/util';
import {
  AcceleratedExitQueue__factory,
  ExitQueue__factory,
} from 'types/typechain';

export const getEpochsToDays = async (
  epochs: number,
  signerState: Nullable<Signer>
) => {
  if (!signerState) {
    return 0;
  }

  const EXIT_QUEUE = new ExitQueue__factory(signerState).attach(
    EXIT_QUEUE_ADDRESS
  );

  const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(
    signerState
  ).attach(ACCELERATED_EXIT_QUEUE_ADDRESS);

  const MAINNET_APROX_BLOCKS_PER_DAY = 6400;
  const epochSizeInBlocks = (await EXIT_QUEUE.epochSize()).toNumber();
  const epochsPerDay = MAINNET_APROX_BLOCKS_PER_DAY / epochSizeInBlocks;

  const accelerationStartEpoch =
    await ACCELERATED_EXIT_QUEUE.accelerationStartAtEpoch();
  const currentEpoch = await ACCELERATED_EXIT_QUEUE.currentEpoch();

  const epochsToDays = epochs / epochsPerDay;
  // Calculate accelerated days
  if (accelerationStartEpoch.lte(currentEpoch)) {
    const num = await ACCELERATED_EXIT_QUEUE.epochAccelerationFactorNumerator();
    const den =
      await ACCELERATED_EXIT_QUEUE.epochAccelerationFactorDenominator();
    const acceleratedDays = epochsToDays / (1 + num.div(den).toNumber());
    return formatNumber(acceleratedDays);
  }

  return formatNumber(epochsToDays);
};

