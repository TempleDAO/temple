import { BigNumber } from 'ethers';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { ZERO } from 'utils/bigNumber';
import { format, isDate } from 'date-fns';

type HookResponseType = [
  {
    isLoading: boolean;
    balance: BigNumber;
    staked: BigNumber;
    nextClaimDate: string | null
  },
  () => Promise<void>
];

const DEFAULT_STATE = {
  isLoading: false,
  balance: ZERO,
  staked: ZERO,
};

export const useVaultBalance = (vaultContractAddress: string): HookResponseType => {
  const { balances: { balances, isLoading }, refreshVaultBalance, vaultGroup, vaultGroups } = useVaultContext();
  const fetchBalance = () => refreshVaultBalance(vaultContractAddress);
  const vaultGroupBalances = balances[vaultGroup!.id];
  const vaultBalance = vaultGroupBalances[vaultContractAddress] || DEFAULT_STATE;

  let nextClaimDate = null;
  const futureClaimableSubvaults = vaultGroups.vaultGroups[0].vaults.filter(vault => !vault.isActive && vault.tvl>0);
  
  if (futureClaimableSubvaults.length > 0) {
    const nextClaimableVault = futureClaimableSubvaults[0];
    if (isDate(nextClaimableVault.unlockDate)) {
      nextClaimDate = format(nextClaimableVault.unlockDate as Date, 'MMM do');
    }
  }

  return [
    {
      isLoading,
      balance: vaultBalance.balance || DEFAULT_STATE.balance,
      staked: vaultBalance.staked || DEFAULT_STATE.staked,
      nextClaimDate: nextClaimDate
    },
    fetchBalance,
  ];
};
