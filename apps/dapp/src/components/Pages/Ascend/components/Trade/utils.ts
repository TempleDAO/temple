import { BigNumber } from 'ethers';

import { DecimalBigNumber, DBN_ONE_HUNDRED } from 'utils/DecimalBigNumber';
import { Nullable } from 'types/util';

export const getSwapLimit = (
  quote: Nullable<DecimalBigNumber>,
  slippageTolerance: number
): Nullable<DecimalBigNumber> => {
  if (!quote) {
    return null;
  }

  const slippage = (100 - slippageTolerance).toString();
  const decimals = slippage.split('.')[1]?.length || 0;
  const bigSlippageTolerance = DecimalBigNumber.parseUnits(slippage, decimals);
  const totalSlippage = quote.sub(
    quote.mul(bigSlippageTolerance).div(DBN_ONE_HUNDRED, quote.getDecimals())
  );
  const limit = quote.sub(totalSlippage);
  return limit;
};

export const getSwapDeadline = (deadlineMinutes: number) => {
  const deadline = new Date(Date.now() + deadlineMinutes * 60 * 1000);
  return BigNumber.from(deadline.getTime());
};
