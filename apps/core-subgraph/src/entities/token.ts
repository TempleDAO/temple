import { Address, BigInt } from '@graphprotocol/graph-ts'

import { Token } from '../../generated/schema'
import { getMetric } from './metric'


export function createToken(address: Address): Token {
  const metric = getMetric()
  metric.tokenCount = metric.tokenCount.plus(BigInt.fromI32(1))
  metric.save()

  const token = new Token(address.toHexString())
  token.save()

  return token as Token
}

export function getOrCreateToken(address: Address): Token {
  let token = Token.load(address.toHexString())

  if (token === null) {
    token = createToken(address)
  }

  return token as Token
}

export function updateToken(address: Address): Token {
  const token = getOrCreateToken(address)

  return token as Token
}
