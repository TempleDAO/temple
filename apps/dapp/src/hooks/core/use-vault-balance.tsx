import { BigNumber } from 'ethers';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { ZERO } from 'utils/bigNumber';

type HookResponseType = [
  {
    isLoading: boolean;
    balance: BigNumber;
    staked: BigNumber;
  },
  () => Promise<void>
];

const DEFAULT_STATE = {
  isLoading: false,
  balance: ZERO,
  staked: ZERO,
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
