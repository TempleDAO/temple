import { CallExceptionError, EthersError, Interface } from "ethers";
import { ITempleLineOfCredit__factory } from "../typechain";

/// Given evm custom errors as per the specified interfaces, attempt to parse
/// an ethers CallException, if successful throw a new error that decodes the custom
/// error.
///
/// Otherwise, just rethrow the original exception
///
/// TODO: once stablised, bake this into the overlord TransactionManager

export async function throwParsedEthersError(e: unknown, errorInterfaces: Interface[]): Promise<never> {
  throw mapParsedEthersException(e, errorInterfaces);
}

export function mapParsedEthersException(e: unknown, errorInterfaces: Interface[]): unknown {
  if ((e as EthersError).code !== "CALL_EXCEPTION") {
    // Rethrow anything that is not an ethers call exception
    return e;
  }
  const callExceptionError = e as CallExceptionError;
  const data = callExceptionError.data;
  if (data === null || data.length === 0 || data === '0x') {
    return e;
  }

  for (const ei of errorInterfaces) {
    const err = ei.parseError(data);
    if (err) {
      const args = err.args.toArray().map(v => v.toString());
      return new Error(`CALL_EXCEPTION: ${err.signature} ${args}\nCause: ${e}`);
    }
  }
  return e;
}


export const ERROR_INTERFACES: Interface[] = [
  ITempleLineOfCredit__factory.createInterface(),
];


