/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type { ITempleTWAP, ITempleTWAPInterface } from "../ITempleTWAP";

const _abi = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amountIn",
        type: "uint256",
      },
    ],
    name: "consult",
    outputs: [],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "update",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export class ITempleTWAP__factory {
  static readonly abi = _abi;
  static createInterface(): ITempleTWAPInterface {
    return new utils.Interface(_abi) as ITempleTWAPInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ITempleTWAP {
    return new Contract(address, _abi, signerOrProvider) as ITempleTWAP;
  }
}
