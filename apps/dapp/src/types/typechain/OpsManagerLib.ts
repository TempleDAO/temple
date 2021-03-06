/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  BaseContract,
  BigNumber,
  BytesLike,
  CallOverrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import { FunctionFragment, Result } from "@ethersproject/abi";
import { Listener, Provider } from "@ethersproject/providers";
import { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";

export interface OpsManagerLibInterface extends utils.Interface {
  contractName: "OpsManagerLib";
  functions: {
    "requiresRebalance(Vault[],TreasuryFarmingRevenue)": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "requiresRebalance",
    values: [any[], string]
  ): string;

  decodeFunctionResult(
    functionFragment: "requiresRebalance",
    data: BytesLike
  ): Result;

  events: {};
}

export interface OpsManagerLib extends BaseContract {
  contractName: "OpsManagerLib";
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: OpsManagerLibInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    requiresRebalance(
      vaults: any[],
      farmingPool: string,
      overrides?: CallOverrides
    ): Promise<[boolean[]]>;
  };

  requiresRebalance(
    vaults: any[],
    farmingPool: string,
    overrides?: CallOverrides
  ): Promise<boolean[]>;

  callStatic: {
    requiresRebalance(
      vaults: any[],
      farmingPool: string,
      overrides?: CallOverrides
    ): Promise<boolean[]>;
  };

  filters: {};

  estimateGas: {
    requiresRebalance(
      vaults: any[],
      farmingPool: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    requiresRebalance(
      vaults: any[],
      farmingPool: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}
