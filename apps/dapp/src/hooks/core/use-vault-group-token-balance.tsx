import { useEffect, useReducer } from 'react';
import { BigNumber, Signer } from 'ethers';

import { Vault__factory } from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';

import { VaultGroup } from 'components/Vault/types';
import { Nullable } from 'types/util';
import useIsMounted from 'hooks/use-is-mounted';

export interface VaultBalance {
  isLoading: boolean;
  balance: Nullable<BigNumber>;
  staked: Nullable<BigNumber>;
}

export interface VaultGroupBalances {
  [vaultAddress: string]: VaultBalance;
}

type Action<A extends ActionType, P extends object> = { type: A; payload: P };

enum ActionType {
  SetVaultsLoading,
  SetVaultBalances,
  SetVaultInstanceLoading,
  SetVaultInstanceBalance,
  OptimisticallyUpdateVaultStaked,
}

type ContractAddressPayload<P extends object> = { vaultAddress: string } & P;

export enum Operation {
  Increase,
  Decrease,
}

type Actions =
  | Action<
      ActionType.SetVaultsLoading,
      { vaultAddresses: string[]; isLoading: boolean }
    >
  | Action<
      ActionType.SetVaultBalances,
      {
        balances: ContractAddressPayload<{
          balance: BigNumber;
          staked: BigNumber;
        }>[];
      }
    >
  | Action<
      ActionType.SetVaultInstanceLoading,
      ContractAddressPayload<{ isLoading: boolean }>
    >
  | Action<
      ActionType.SetVaultInstanceBalance,
      ContractAddressPayload<{ balance: BigNumber }>
    >
  | Action<
      ActionType.OptimisticallyUpdateVaultStaked,
      ContractAddressPayload<{ operation: Operation; amount: BigNumber }>
    >;

const reducer = (
  state: VaultGroupBalances,
  action: Actions
): VaultGroupBalances => {
  switch (action.type) {
    case ActionType.SetVaultsLoading: {
      const { vaultAddresses, isLoading } = action.payload;
      return {
        ...state,
        ...vaultAddresses.reduce(
          (acc, address) => ({
            ...acc,
            [address]: {
              ...state[address],
              isLoading,
            },
          }),
          {}
        ),
      };
    }
    case ActionType.SetVaultBalances: {
      return {
        ...state,
        ...action.payload.balances.reduce(
          (acc, { vaultAddress, balance, staked }) => ({
            ...acc,
            [vaultAddress]: {
              ...state[vaultAddress],
              balance,
              staked,
            },
          }),
          {}
        ),
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
      const zeroBn = BigNumber.from(0);
      const currentStake = state[vaultAddress]?.staked || zeroBn;
      const nextStake =
        operation === Operation.Increase
          ? currentStake.add(amount)
          : currentStake.sub(amount);
      return {
        ...state,
        [vaultAddress]: {
          ...state[vaultAddress],
          staked: nextStake.lt(zeroBn) ? zeroBn : nextStake,
        },
      };
    }
    default:
      return state;
  }
};

const useVaultGroupReducer = () => {
  const [state, dispatch] = useReducer(reducer, {});

  return {
    balances: state,
    setVaultsLoading: (vaultAddresses: string[], isLoading: boolean) =>
      dispatch({
        type: ActionType.SetVaultsLoading,
        payload: { vaultAddresses, isLoading },
      }),
    setVaultBalances: (
      balances: ContractAddressPayload<{
        balance: BigNumber;
        staked: BigNumber;
      }>[]
    ) => dispatch({ type: ActionType.SetVaultBalances, payload: { balances } }),
    setVaultInstanceLoading: (vaultAddress: string, isLoading: boolean) =>
      dispatch({
        type: ActionType.SetVaultInstanceLoading,
        payload: { vaultAddress, isLoading },
      }),
    setVaultInstanceBalance: (vaultAddress: string, balance: BigNumber) =>
      dispatch({
        type: ActionType.SetVaultInstanceBalance,
        payload: { vaultAddress, balance },
      }),
    optimisticallyUpdateVaultStaked: (
      vaultAddress: string,
      operation: Operation,
      amount: BigNumber
    ) =>
      dispatch({
        type: ActionType.OptimisticallyUpdateVaultStaked,
        payload: { vaultAddress, operation, amount },
      }),
  };
};

interface VaultInstanceResponse {
  vaultAddress: string;
  balance: BigNumber;
}

const getVaultInstanceBalance = async (
  vaultAddress: string,
  wallet: string,
  signer: Signer
): Promise<VaultInstanceResponse> => {
  const vault = new Vault__factory(signer).attach(vaultAddress);

  const shares = await vault.shareBalanceOf(wallet);
  const tokenShareBalance = await vault.toTokenAmount(shares);
  return {
    vaultAddress,
    balance: tokenShareBalance,
  };
};

export const useVaultGroupBalances = (vaultGroups: Nullable<VaultGroup[]>) => {
  const isMounted = useIsMounted();
  const { signer, wallet, isConnected } = useWallet();
  const {
    balances,
    setVaultsLoading,
    setVaultBalances,
    setVaultInstanceLoading,
    setVaultInstanceBalance,
    optimisticallyUpdateVaultStaked,
  } = useVaultGroupReducer();

  const getVaultGroupBalances = async () => {
    if (!signer || !wallet || !vaultGroups?.length) {
      console.error(
        `Attempted to fetch VaultGroup Balances without a signer or wallet.`
      );
      return;
    }

    return Promise.all(
      vaultGroups.map(async (vaultGroup) => {
        const vaultIds = vaultGroup.vaults.map(({ id }) => id);
        setVaultsLoading(vaultIds, true);

        try {
          const response = await Promise.all(
            vaultGroup!.vaults.map(({ id: vaultAddress, amountStaked }) => {
              return getVaultInstanceBalance(vaultAddress, wallet, signer).then(
                (response) => ({
                  ...response,
                  staked: amountStaked || 0,
                })
              );
            })
          );

          if (isMounted.current) {
            setVaultBalances(response);
            setVaultsLoading(vaultIds, false);
          }
        } catch (err) {
          if (isMounted.current) {
            setVaultsLoading(vaultIds, false);
          }

          throw err;
        }
      })
    );
  };

  const [fetchVaultGroupBalances, { isLoading: groupRequestLoading, error }] =
    useRequestState(getVaultGroupBalances);

  const hasVaultGroups = (vaultGroups || []).length > 0;

  useEffect(() => {
    if (!isConnected || !hasVaultGroups) {
      return;
    }

    fetchVaultGroupBalances();
  }, [isConnected, hasVaultGroups, fetchVaultGroupBalances]);

  const fetchVaultBalance = async (vaultAddress: string) => {
    if (!signer || !wallet) {
      return;
    }

    try {
      setVaultInstanceLoading(vaultAddress, true);
      const { balance } = await getVaultInstanceBalance(
        vaultAddress,
        wallet,
        signer
      );
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

  const isLoading =
    groupRequestLoading ||
    Object.values(balances).some((vaultGroup) =>
      Object.values(vaultGroup).some((vault) => vault.isLoading)
    );

  return {
    error,
    balances,
    isLoading,
    fetchVaultBalance,
    refetchVaultGroupBalances: fetchVaultGroupBalances,
    optimisticallyUpdateVaultStaked,
  };
};
