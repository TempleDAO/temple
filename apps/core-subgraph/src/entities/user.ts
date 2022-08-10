import { Address, BigInt } from '@graphprotocol/graph-ts'

import { User, UserDayData } from '../../generated/schema'

import { dayFromTimestamp } from '../utils/dates'
import { getMetric, updateMetric } from './metric'
import { BIG_DECIMAL_0, BIG_INT_1 } from '../utils/constants'


export function createUser(address: Address, timestamp: BigInt): User {
  const metric = getMetric()
  metric.userCount = metric.userCount.plus(BIG_INT_1)
  updateMetric(metric, timestamp)

  const user = new User(address.toHexString())
  user.timestamp = timestamp
  user.depositsBalance = BIG_DECIMAL_0
  user.withdrawsBalance = BIG_DECIMAL_0
  user.totalBalance = BIG_DECIMAL_0
  user.save()

  updateOrCreateDayData(user, timestamp)

  return user as User
}

export function getOrCreateUser(address: Address, timestamp: BigInt): User {
  let user = User.load(address.toHexString())

  if (user === null) {
    user = createUser(address, timestamp)
  }

  return user as User
}

export function updateUser(user: User, timestamp: BigInt): void {
  user.timestamp = timestamp
  user.save()

  updateOrCreateDayData(user, timestamp)
}

export function updateOrCreateDayData(user: User, timestamp: BigInt): void {
  const dayTimestamp = dayFromTimestamp(timestamp);
  const dayDataID = dayTimestamp + user.id;

  let dayData = UserDayData.load(dayDataID)
  if (dayData === null) {
    dayData = new UserDayData(dayDataID)
  }

  dayData.user = user.id
  dayData.timestamp = timestamp
  dayData.depositsBalance = user.depositsBalance
  dayData.withdrawsBalance = user.withdrawsBalance
  dayData.totalBalance = user.totalBalance
  dayData.save()
}
