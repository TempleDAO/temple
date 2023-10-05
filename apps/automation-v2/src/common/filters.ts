import { EventLog, BaseContract } from 'ethers';
import {
  TypedContractEvent,
  TypedDeferredTopicFilter,
} from '@/typechain/common';

/**
 * If a log matches the specified address and filter,
 * return these parsed and mapped to the appropriate type
 */
export function matchAndDecodeEvent<
  TInputTuple extends unknown[],
  TOutputTuple extends unknown[],
  TArgsObject
>(
  ev: EventLog,
  contract: BaseContract,
  eventFilter: TypedDeferredTopicFilter<
    TypedContractEvent<TInputTuple, TOutputTuple, TArgsObject>
  >
): TArgsObject | undefined {
  const evTopics = ev.topics.map((e) => e);
  if (matchTopics([eventFilter.fragment.topicHash], evTopics)) {
    const logs = contract.interface.parseLog({
      topics: evTopics,
      data: ev.data,
    });
    if (!logs) return undefined;
    return logs.args as TArgsObject;
  }
}

function matchTopics(
  filter: Array<null | string | Array<string>> | undefined,
  value: Array<string>
): boolean {
  // Implement the logic for topic filtering as described here:
  // https://docs.ethers.io/v5/concepts/events/#events--filters
  if (!filter) return false;
  for (let i = 0; i < filter.length; i++) {
    const f = filter[i];
    if (f === null) return false;
    const v = value[i];
    if (typeof f == 'string') {
      if (f !== v) return false;
    } else {
      if (f.indexOf(v) === -1) return false;
    }
  }
  return true;
}
