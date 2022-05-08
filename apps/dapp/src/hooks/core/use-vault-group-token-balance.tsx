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

export interface VaultGroupBalance {
  [vaultAddress: string]: {
    isLoading: boolean;
    balance: Nullable<number>;
  };
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
}

type ContractAddressPayload<P extends object> = { vaultAddress: string; } & P;

type Actions = 
  Action<ActionType.SetVaultGroupLoading, { isLoading: boolean }> |
  Action<ActionType.SetVaultGroupBalance, { balances: ContractAddressPayload<{ balance: number }>[] }> |
  Action<ActionType.SetVaultInstanceLoading, ContractAddressPayload<{ isLoading: boolean }>> |
  Action<ActionType.SetVaultInstanceBalance, ContractAddressPayload<{ balance: number }>>;

const vaultGroupReducer = (state: VaultGroupBalance, action: Actions): VaultGroupBalance => {
  switch (action.type) {
    case ActionType.SetVaultGroupLoading:
      return Object.entries(state).reduce((acc, [vaultAddress, state]) => ({
        ...acc,
        [vaultAddress]: {
          ...state,
          isLoading: action.payload.isLoading,
        },
      }), {});
    case ActionType.SetVaultGroupBalance:
      return {
        ...state,
        ...action.payload.balances.reduce((acc, { vaultAddress, balance }) => ({
          ...acc,
          [vaultAddress]: {
            ...state[vaultAddress],
            balance,
          },
        }), {}),
      };
    case ActionType.SetVaultInstanceLoading:
      return {
        ...state,
        [action.payload.vaultAddress]: {
          ...state[action.payload.vaultAddress],
          isLoading: action.payload.isLoading,
        },
      };
    case ActionType.SetVaultInstanceBalance:
      return {
        ...state,
        [action.payload.vaultAddress]: {
          ...state[action.payload.vaultAddress],
          balance: action.payload.balance,
        },
      };
    default:
      return state;
  }
}

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
    setVaultGroupBalance: (vaultGroupId: string, balances: ContractAddressPayload<{ balance: number }>[] ) => 
      dispatch({ type: ActionType.SetVaultGroupBalance, payload: { vaultGroupId, balances } }),
    setVaultInstanceLoading: (vaultGroupId: string, vaultAddress: string, isLoading: boolean) =>
      dispatch({ type: ActionType.SetVaultInstanceLoading, payload: { vaultGroupId, vaultAddress, isLoading} }),
    setVaultInstanceBalance: (vaultGroupId: string, vaultAddress: string, balance: number) => 
      dispatch({ type: ActionType.SetVaultInstanceBalance, payload: { vaultGroupId, vaultAddress, balance } }),
  };
}

const getVaultInstanceBalance = async (vaultAddress: string, wallet: string, signer: Signer): Promise<{ vaultAddress: string; balance: number }> => {
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
  } = useVaultGroupReducer()
  
  const getVaultGroupBalances = async () => {
    if (!signer || !wallet || !vaultGroups?.length) {
      console.error(`Attempted to fetch VaultGroup Balances without a signer or wallet.`);
      return;
    }

    return Promise.all(vaultGroups.map(async (vaultGroup) => {
      setVaultGroupLoading(vaultGroup.id, true);

      try {
        const response = await Promise.all(vaultGroup!.vaults.map(({ id: vaultAddress }) => {
          return getVaultInstanceBalance(vaultAddress, wallet, signer);
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

  const fetchVaultBalance = async (vaultAddress: string) => {
    if (!signer || !wallet) {
      return;
    }

    // try {
    //   setVaultInstanceLoading(vaultAddress, true);
    //   const [_, balance] = await getVaultInstanceBalance(vaultAddress, wallet, signer);
    //   if (isMounted.current) {
    //     setVaultInstanceBalance(vaultAddress, balance);
    //     setVaultInstanceLoading(vaultAddress, false);
    //   }
    // } catch (err) {
    //   console.error(`Failed to refetch Vault ${vaultAddress} balance`);
    //   if (isMounted.current) {
    //     setVaultInstanceLoading(vaultAddress, false);
    //   }
    // }
  };
  
  const isLoading = groupRequestLoading || Object.values(balances).some(({ isLoading }) => isLoading);

  return {
    error,
    balances,
    isLoading,
    fetchVaultBalance,
    refetchVaultGroupBalances: fetchVaultGroupBalances,
  };
};
