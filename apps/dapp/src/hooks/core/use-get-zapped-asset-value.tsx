import { VaultProxy__factory } from 'types/typechain';
import { toAtto, ZERO } from 'utils/bigNumber';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';
import { getBigNumberFromString } from 'components/Vault/utils';

import { useFaith } from 'providers/FaithProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useOGTempleStakingValue } from 'hooks/core/use-ogtemple-staking-value';
import { BigNumber } from 'ethers';
import env from 'constants/env';

export const useGetZappedAssetValue = () => {
  const { signer } = useWallet();
  const {
    faith: { usableFaith },
  } = useFaith();
  const [getStakingValue] = useOGTempleStakingValue();

  const handler = async (
    ticker: TICKER_SYMBOL,
    amount: string,
    withFaith = false
  ) => {
    if (!signer) {
      console.error(
        'Attempted to get faithDepositMultiplier without a signer.'
      );
      return;
    }

    let bigTempleAmount: BigNumber;
    if (ticker === TICKER_SYMBOL.TEMPLE_TOKEN) {
      bigTempleAmount = getBigNumberFromString(amount);
    } else if (ticker === TICKER_SYMBOL.OG_TEMPLE_TOKEN) {
      const stakingValue = await getStakingValue(amount);
      bigTempleAmount = stakingValue!;
    } else {
      throw new Error(
        `Programming Error: Attempted to get zapped asset value for unsupported token ${ticker}`
      );
    }

    // The wallet needs to have usableFaith to get any multiplier. If there is no usableFaith
    // we can skip the contract call and just return the deposit amount.
    if (!withFaith || usableFaith.eq(ZERO)) {
      return {
        temple: bigTempleAmount,
        bonus: ZERO,
        total: bigTempleAmount,
      };
    }

    const vaultProxy = new VaultProxy__factory(signer).attach(
      env.contracts.vaultProxy
    );

    // If the user is depositing with FAITH, the will get a boosted amount of TEMPLE deposited.
    // we need to calculate the deposit amount plus the amount of TEMPLE the FAITH converts to.
    const templeWithFaithAmount = await vaultProxy.getFaithMultiplier(
      usableFaith,
      bigTempleAmount
    );
    return {
      temple: bigTempleAmount,
      bonus: templeWithFaithAmount.sub(bigTempleAmount),
      total: templeWithFaithAmount,
    };
  };

  return useRequestState(handler, { purgeResponseOnRefetch: true });
};
