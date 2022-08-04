import { BigNumber } from 'ethers';

import { Nullable } from 'types/util';

export const getSwapLimit = (quote: Nullable<BigNumber>, slippageTolerance: number) => {
  if (!quote) {
    return null;
  }

  const totalSlippage = quote.sub(quote.mul(100 - slippageTolerance).div(100));
  const limit = quote.sub(totalSlippage);
  return limit;
};

export const getSwapDeadline = (deadlineMinutes: number) => {
  const deadline = new Date(Date.now() + deadlineMinutes * 60 * 1000);
  return BigNumber.from(deadline.getTime());
}