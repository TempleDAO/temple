import { ethers, providers } from 'ethers';
import { TypedEventFilter, TypedEvent } from '@/typechain/common';

/**
 * If a log matches the specified address and filter,
 * return these parsed and mapped to the appropriate type
 */
export function matchLog<TArgsArray extends unknown[], TArgsObject>(
  ev: providers.Log,
  contract: ethers.BaseContract,
  eventFilter: TypedEventFilter<TypedEvent<TArgsArray, TArgsObject>>
): (TArgsArray & TArgsObject) | undefined {
  if (eventFilter.address && eventFilter.address !== ev.address) {
    return undefined;
  }

  if (!matchTopics(eventFilter.topics, ev.topics)) {
    return undefined;
  }
  const args = contract.interface.parseLog(ev).args;
  return args as TArgsArray & TArgsObject;
}

function matchTopics(
  filter: Array<string | Array<string>> | undefined,
  value: Array<string>
): boolean {
  // Implement the logic for topic filtering as described here:
  // https://docs.ethers.io/v5/concepts/events/#events--filters
  if (!filter) {
    return false;
  }
  for (let i = 0; i < filter.length; i++) {
    const f = filter[i];
    const v = value[i];
    if (typeof f == 'string') {
      if (f !== v) {
        return false;
      }
    } else {
      if (f.indexOf(v) === -1) {
        return false;
      }
    }
  }
  return true;
}
