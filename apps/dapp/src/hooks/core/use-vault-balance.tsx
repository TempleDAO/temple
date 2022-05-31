import { Nullable } from 'types/util';
import { useVaultContext } from 'components/Pages/Core/VaultContext';

type HookResponseType = [
  {
    isLoading: boolean;
    balance: Nullable<number>,
    staked: Nullable<number>,
  },
  () => Promise<void>,
] 

export const useVaultBalance = (vaultContractAddress: string): HookResponseType => {
  const { balances, refreshVaultBalance } = useVaultContext();
  const fetchBalance = () => refreshVaultBalance(vaultContractAddress);
  const vaultBalance = balances[vaultContractAddress] || { isLoading: false, balance: 0, staked: 0, };

  return [
    vaultBalance,
    fetchBalance,
  ];
};
