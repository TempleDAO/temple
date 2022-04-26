import { Address, BigInt } from '@graphprotocol/graph-ts'

import { User } from '../../generated/schema'
import { getMetric } from './metric'


export function createUser(address: Address): User {
  const metric = getMetric()
  metric.userCount = metric.userCount.plus(BigInt.fromI32(1))
  metric.save()

  const user = new User(address.toHexString())
  user.save()

  return user as User
}

export function getOrCreateUser(address: Address): User {
  let user = User.load(address.toHexString())

  if (user === null) {
    user = createUser(address)
  }

  return user as User
}

export function updateUser(address: Address): User {
  const user = getOrCreateUser(address)

  return user as User
}
