import { useEffect, useReducer } from 'react';
import { Signer } from 'ethers';

import {
  Vault__factory,
} from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';

import { fromAtto } from 'utils/bigNumber';
import { VaultGroup } from 'components/Vault/types';
import { Nullable } from 'types/util';
import useIsMounted from 'hooks/use-is-mounted';

interface VaultBalance {
  isLoading: boolean;
  balance: Nullable<number>;
  staked: Nullable<number>;
}

export interface VaultGroupBalance {
  [vaultAddress: string]: VaultBalance;
}

export interface VaultGroupBalances {
  [vaultGroupId: string]: VaultGroupBalance;
};

type Action<A extends ActionType, P extends object> = { type: A, payload: { vaultGroupId: string; } & P };

enum ActionType {
  SetVaultGroupLoading,
  SetVaultGroupBalance,
  SetVaultInstanceLoading,
  SetVaultInstanceBalance,
  OptimisticallyUpdateVaultStaked,
}

type ContractAddressPayload<P extends object> = { vaultAddress: string; } & P;

export enum Operation {
  Increase,
  Decrease,
};

type Actions = 
  Action<ActionType.SetVaultGroupLoading, { isLoading: boolean }> |
  Action<ActionType.SetVaultGroupBalance, { balances: ContractAddressPayload<{ balance: number, staked: number }>[] }> |
  Action<ActionType.SetVaultInstanceLoading, ContractAddressPayload<{ isLoading: boolean }>> |
  Action<ActionType.SetVaultInstanceBalance, ContractAddressPayload<{ balance: number }>> |
  Action<ActionType.OptimisticallyUpdateVaultStaked, ContractAddressPayload<{ operation: Operation, amount: number }>>;

const vaultGroupReducer = (state: VaultGroupBalance, action: Actions): VaultGroupBalance => {
  switch (action.type) {
    case ActionType.SetVaultGroupLoading: {
      return Object.entries(state).reduce((acc, [vaultAddress, state]) => ({
        ...acc,
        [vaultAddress]: {
          ...state,
          isLoading: action.payload.isLoading,
        },
      }), {});
    }
    case ActionType.SetVaultGroupBalance: {
      return {
        ...state,
        ...action.payload.balances.reduce((acc, { vaultAddress, balance, staked }) => ({
          ...acc,
          [vaultAddress]: {
            ...state[vaultAddress],
            balance,
            staked,
          },
        }), {}),
      };
    }
    case ActionType.SetVaultInstanceLoading: {
      const { vaultAddress, isLoading } = action.payload;
      return {
        ...state,
        [vaultAddress]: {
          ...state[vaultAddress],
          isLoading,
        },
      };
    }
    case ActionType.SetVaultInstanceBalance: {
      const { vaultAddress, balance } = action.payload;
      return {
        ...state,
        [vaultAddress]: {
          ...state[vaultAddress],
          balance,
        },
      };
    }
    case ActionType.OptimisticallyUpdateVaultStaked: {
      const { vaultAddress, amount, operation } = action.payload;
      const currentStake = state[vaultAddress]?.staked || 0;
      const nextStake = operation === Operation.Increase ? currentStake + amount : currentStake - amount;
      return {
        ...state,
        [vaultAddress]: {
          ...state[vaultAddress],
          staked: nextStake < 0 ? 0 : nextStake,
        },
      };
    }
    default:
      return state;
  }
};

const useVaultGroupReducer = () => {
  const reducer = (state: VaultGroupBalances, action: Actions): VaultGroupBalances => {
    const { vaultGroupId } = action.payload;
    const currentVaultGroupState = state[vaultGroupId] || {};
    return {
      ...state,
      [vaultGroupId]: vaultGroupReducer(currentVaultGroupState, action),
    };
  };

  const [state, dispatch] = useReducer(reducer, {});
  
  return {
    balances: state,
    setVaultGroupLoading: (vaultGroupId: string, isLoading: boolean) =>
      dispatch({ type: ActionType.SetVaultGroupLoading, payload: { vaultGroupId, isLoading } }),
    setVaultGroupBalance: (vaultGroupId: string, balances: ContractAddressPayload<{ balance: number, staked: number }>[] ) => 
      dispatch({ type: ActionType.SetVaultGroupBalance, payload: { vaultGroupId, balances } }),
    setVaultInstanceLoading: (vaultGroupId: string, vaultAddress: string, isLoading: boolean) =>
      dispatch({ type: ActionType.SetVaultInstanceLoading, payload: { vaultGroupId, vaultAddress, isLoading} }),
    setVaultInstanceBalance: (vaultGroupId: string, vaultAddress: string, balance: number) => 
      dispatch({ type: ActionType.SetVaultInstanceBalance, payload: { vaultGroupId, vaultAddress, balance } }),
    optimisticallyUpdateVaultStaked: (vaultGroupId: string, vaultAddress: string, operation: Operation, amount: number) =>
      dispatch({ type: ActionType.OptimisticallyUpdateVaultStaked, payload: { vaultAddress, vaultGroupId, operation, amount }}),
  };
};

interface VaultInstanceResponse {
  vaultAddress: string;
  balance: number;
}

const getVaultInstanceBalance = async (vaultAddress: string, wallet: string, signer: Signer): Promise<VaultInstanceResponse> => {
  const vault = new Vault__factory(signer).attach(vaultAddress);
  const shares = await vault.shareBalanceOf(wallet);
  const tokenShareBalance = await vault.toTokenAmount(shares);
  return {
    vaultAddress,
    balance: fromAtto(tokenShareBalance),
  };
};

export const useVaultGroupBalances = (vaultGroups: Nullable<VaultGroup[]>) => {
  const isMounted = useIsMounted();
  const { signer, wallet, isConnected } = useWallet();
  const {
    balances,
    setVaultGroupLoading,
    setVaultGroupBalance,
    setVaultInstanceLoading,
    setVaultInstanceBalance,
    optimisticallyUpdateVaultStaked
  } = useVaultGroupReducer()

  const getVaultGroupBalances = async () => {
    if (!signer || !wallet || !vaultGroups?.length) {
      console.error(`Attempted to fetch VaultGroup Balances without a signer or wallet.`);
      return;
    }

    return Promise.all(vaultGroups.map(async (vaultGroup) => {
      setVaultGroupLoading(vaultGroup.id, true);

      try {
        const response = await Promise.all(vaultGroup!.vaults.map(({ id: vaultAddress, amountStaked }) => {
          return getVaultInstanceBalance(vaultAddress, wallet, signer).then((response) => ({
            ...response,
            staked: amountStaked || 0,
          }));
        }));

        if (isMounted.current) {
          setVaultGroupBalance(vaultGroup.id, response);
          setVaultGroupLoading(vaultGroup.id, false);
        }
      } catch (err) {
        if (isMounted.current) {
          setVaultGroupLoading(vaultGroup.id, false);
        }
        
        throw err;
      }
    }));
  };

  const [fetchVaultGroupBalances, { isLoading: groupRequestLoading, error }] = useRequestState(getVaultGroupBalances);

  const hasVaultGroups = (vaultGroups || []).length > 0;

  useEffect(() => {
    if (!isConnected || !hasVaultGroups) {
      return;
    }

    fetchVaultGroupBalances();
  }, [
    isConnected,
    hasVaultGroups,
    fetchVaultGroupBalances,
  ]);

  const fetchVaultBalance = async (vaultGroupId: string, vaultAddress: string) => {
    if (!signer || !wallet) {
      return;
    }

    try {
      setVaultInstanceLoading(vaultGroupId, vaultAddress, true);
      const { balance } = await getVaultInstanceBalance(vaultAddress, wallet, signer);
      if (isMounted.current) {
        setVaultInstanceBalance(vaultGroupId, vaultAddress, balance);
        setVaultInstanceLoading(vaultGroupId, vaultAddress, false);
      }
    } catch (err) {
      console.error(`Failed to refetch Vault ${vaultAddress} balance`);
      if (isMounted.current) {
        setVaultInstanceLoading(vaultGroupId, vaultAddress, false);
      }
    }
  };
  
  const isLoading = groupRequestLoading || 
    Object.values(balances).some((vaultGroup) => Object.values(vaultGroup).some((vault) => vault.isLoading));

  return {
    error,
    balances,
    isLoading,
    fetchVaultBalance,
    refetchVaultGroupBalances: fetchVaultGroupBalances,
    optimisticallyUpdateVaultStaked, 
  };
};
