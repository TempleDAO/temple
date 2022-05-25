import { VaultProxy__factory } from 'types/typechain';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';

import { useFaith } from 'providers/FaithProvider';

const ENV = import.meta.env;

export const useFaithDepositMultiplier = () => {
  const { signer } = useWallet();
  const { faith: { usableFaith } } = useFaith();

  const handler = async (amount: number) => {
    if (!signer) {
      console.error('Attempted to get faithDepositMultiplier without a signer.');
      return;
    }

    // The wallet needs to have usableFaith to get any multiplier. If there is no usableFaith
    // we can skip the contract call and just return the deposit amount.
    if (usableFaith === 0) {
      return amount;
    }
   
    const vaultProxy = new VaultProxy__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_VAULT_PROXY);
    
    // If the user is depositing with FAITH, the will get a boosted amount of TEMPLE deposited.
    // we need to calculate the deposit amount plus the amount of TEMPLE the FAITH converts to.
    const templeWithFaithAmount = await vaultProxy.getFaithMultiplier(toAtto(usableFaith), toAtto(amount));
    return fromAtto(templeWithFaithAmount);
  };

  return useRequestState(handler);
};
