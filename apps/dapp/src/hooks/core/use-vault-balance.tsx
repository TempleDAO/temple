import { BigNumber } from 'ethers';
import { Nullable } from 'types/util';
import { useVaultContext } from 'components/Pages/Core/VaultContext';

type HookResponseType = [
  {
    isLoading: boolean;
    balance: BigNumber,
    staked: BigNumber,
  },
  () => Promise<void>,
];

const DEFAULT_STATE = {
  isLoading: false,
  balance: BigNumber.from(0),
  staked: BigNumber.from(0),
};

export const useVaultBalance = (vaultContractAddress: string): HookResponseType => {
  const { balances, refreshVaultBalance } = useVaultContext();
  const fetchBalance = () => refreshVaultBalance(vaultContractAddress);
  const vaultBalance = balances[vaultContractAddress] || DEFAULT_STATE;

  return [
    {
      isLoading: vaultBalance.isLoading,
      balance: vaultBalance.balance || DEFAULT_STATE.balance,
      staked: vaultBalance.staked || DEFAULT_STATE.staked,
    },
    fetchBalance,
  ];
};
