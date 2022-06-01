import { Address, BigInt } from '@graphprotocol/graph-ts'

import { Token } from '../../generated/schema'

import { getMetric, updateMetric } from './metric'
import { BIG_INT_1 } from '../utils/constants'


export function createToken(address: Address, timestamp: BigInt): Token {
  const metric = getMetric()
  metric.tokenCount = metric.tokenCount.plus(BIG_INT_1)
  updateMetric(metric, timestamp)

  const token = new Token(address.toHexString())
  token.timestamp = timestamp
  token.save()

  return token as Token
}

export function getOrCreateToken(address: Address, timestamp: BigInt): Token {
  let token = Token.load(address.toHexString())

  if (token === null) {
    token = createToken(address, timestamp)
  }

  return token as Token
}

export function updateToken(token: Token, timestamp: BigInt): void {
  token.timestamp = timestamp
  token.save()
}
