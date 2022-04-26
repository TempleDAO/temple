import { Address, BigInt } from '@graphprotocol/graph-ts'

import { Pair } from '../../generated/schema'
import { getMetric } from './metric'


export function createPair(address: Address): Pair {
  const metric = getMetric()
  metric.pairCount = metric.pairCount.plus(BigInt.fromI32(1))
  metric.save()

  const pair = new Pair(address.toHexString())
  pair.save()

  return pair as Pair
}

export function getOrCreatePair(address: Address): Pair {
  let pair = Pair.load(address.toHexString())

  if (pair === null) {
    pair = createPair(address)
  }

  return pair as Pair
}

export function updatePair(address: Address): Pair {
  const pair = getOrCreatePair(address)

  return pair as Pair
}
