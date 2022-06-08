import { BigNumber } from 'ethers';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { ZERO } from 'utils/bigNumber';
import { asyncNoopBool } from 'utils/helpers';

type HookResponseType = [
  {
    isLoading: boolean;
    balance: BigNumber;
    staked: BigNumber;
    canExit: Function;
  },
  () => Promise<void>
];

const DEFAULT_STATE = {
  isLoading: false,
  balance: ZERO,
  staked: ZERO,
};

export const useVaultBalance = (vaultContractAddress: string): HookResponseType => {
  const { balances, refreshVaultBalance, canExit: _canExit } = useVaultContext();
  const fetchBalance = () => refreshVaultBalance(vaultContractAddress);
  const vaultBalance = balances[vaultContractAddress] || DEFAULT_STATE;
  const canExit = () => _canExit(vaultContractAddress);
  return [
    {
      isLoading: vaultBalance.isLoading,
      balance: vaultBalance.balance || DEFAULT_STATE.balance,
      staked: vaultBalance.staked || DEFAULT_STATE.staked,
      canExit,
    },
    fetchBalance,
  ];
};
