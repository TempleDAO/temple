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

export interface VaultGroupBalances {
  [vaultAddress: string]: {
    isLoading: boolean;
    balance: Nullable<number>;
  };
};

type Action<A extends ActionType, P extends any> = { type: A, payload: P };

enum ActionType {
  SetVaultGroupLoading,
  SetVaultGroupBalance,
  SetVaultInstanceLoading,
  SetVaultInstanceBalance,
}

type Actions = 
  Action<ActionType.SetVaultGroupLoading, boolean> |
  Action<ActionType.SetVaultGroupBalance, [string, number][]> |
  Action<ActionType.SetVaultInstanceLoading, [string, boolean]> |
  Action<ActionType.SetVaultInstanceBalance, [string, number]>;

const useVaultGroupReducer = () => {
  const reducer = (state: VaultGroupBalances, action: Actions): VaultGroupBalances => {
    switch (action.type) {
      case ActionType.SetVaultGroupLoading:
        return Object.entries(state).reduce((acc, [address, state]) => ({
          ...acc,
          [address]: {
            ...state,
            isLoading: action.payload,
          },
        }), {});
      case ActionType.SetVaultGroupBalance:
        return {
          ...state,
          ...action.payload.reduce((acc, [address, balance]) => ({
            ...acc,
            [address]: {
              ...state[address],
              balance,
            },
          }), {}),
        };
      case ActionType.SetVaultInstanceLoading:
        const [instanceAddress, isLoading] = action.payload;
        return {
          ...state,
          [instanceAddress]: {
            ...state[instanceAddress],
            isLoading,
          },
        };
      case ActionType.SetVaultInstanceBalance:
        const [address, balance] = action.payload;
        return {
          ...state,
          [address]: {
            ...state[address],
            balance,
          },
        };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, {});
  
  return {
    balances: state,
    setVaultGroupLoading: 
      (loading: boolean) => dispatch({ type: ActionType.SetVaultGroupLoading, payload: loading }),
    setVaultGroupBalance:
      (balance: [string, number][] ) => dispatch({ type: ActionType.SetVaultGroupBalance, payload: balance }),
    setVaultInstanceLoading:
      (address: string, loading: boolean) => dispatch({ type: ActionType.SetVaultInstanceLoading, payload: [address, loading] }),
    setVaultInstanceBalance:
      (address: string, balance: number) => dispatch({ type: ActionType.SetVaultInstanceBalance, payload: [address, balance] }),
  };
}

const getVaultInstanceBalance = async (vaultAddress: string, wallet: string, signer: Signer): Promise<[string, number]> => {
  const vault = new Vault__factory(signer).attach(vaultAddress);
  const shares = await vault.shareBalanceOf(wallet);
  const tokenShareBalance = await vault.toTokenAmount(shares);
  return [
    vaultAddress,
    fromAtto(tokenShareBalance),
  ];
};

export const useVaultGroupBalances = (vaultGroup: Nullable<VaultGroup>) => {
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
    if (!signer || !wallet || !vaultGroup) {
      console.error(`Attempted to fetch VaultGroup ${vaultGroup?.id} without a signer or wallet.`);
      return;
    }

    setVaultGroupLoading(true);

    try {
      const response = await Promise.all(vaultGroup!.vaults.map(({ id: vaultAddress }) => {
        return getVaultInstanceBalance(vaultAddress, wallet, signer);
      }));

      if (isMounted.current) {
        setVaultGroupBalance(response);
        setVaultGroupLoading(false);
      }
    } catch (err) {
      if (isMounted.current) {
        setVaultGroupLoading(false);
      }
      
      throw err;
    }
  };

  const [fetchVaultGroupBalances, { isLoading: groupRequestLoading, error }] = useRequestState(getVaultGroupBalances);

  const vaultGroupId = vaultGroup?.id;

  useEffect(() => {
    if (!isConnected || !vaultGroupId) {
      return;
    }

    fetchVaultGroupBalances();
  }, [
    isConnected,
    vaultGroupId,
    fetchVaultGroupBalances,
  ]);

  const fetchVaultBalance = async (vaultAddress: string) => {
    if (!signer || !wallet) {
      console.error(`Attempted to fetch vault ${vaultAddress} without a signer or wallet.`);
      return;
    }

    try {
      setVaultInstanceLoading(vaultAddress, true);
      const [_, balance] = await getVaultInstanceBalance(vaultAddress, wallet, signer);
      if (isMounted.current) {
        setVaultInstanceBalance(vaultAddress, balance);
        setVaultInstanceLoading(vaultAddress, false);
      }
    } catch (err) {
      console.error(`Failed to refetch Vault ${vaultAddress} balance`);
      if (isMounted.current) {
        setVaultInstanceLoading(vaultAddress, false);
      }
    }
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
