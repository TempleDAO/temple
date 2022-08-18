import { Address, ethereum } from '@graphprotocol/graph-ts'

import { Deposit as DepositEvent } from '../../generated/OpsManager/Vault'
import { Deposit } from '../../generated/schema'

import { getMetric, updateMetric } from './metric'
import { getOrCreateUser, updateUser } from './user'
import { getOrCreateToken } from './token'
import { toDecimal } from '../utils/decimals'
import { getVault, saveVault } from './vault'
import { getOrCreateVaultUserBalance, updateVaultUserBalance } from './vaultUserBalance'
import { getVaultGroup, saveVaultGroup } from './vaultGroup'
import { BIG_DECIMAL_0, BIG_INT_1, TEMPLE_ADDRESS } from '../utils/constants'
import { getTemplePrice } from '../utils/prices'


export function createDeposit(event: DepositEvent): Deposit {
  const timestamp = event.block.timestamp
  const amount = toDecimal(event.params.amount, 18)
  const staked = toDecimal(event.params.amountStaked, 18)
  const tokenPrice = getTemplePrice()

  const deposit = new Deposit(event.transaction.hash.toHexString())
  deposit.timestamp = timestamp

  const token = getOrCreateToken(TEMPLE_ADDRESS, timestamp)
  deposit.token = token.id

  const vault = getVault(event.address as Address)
  deposit.vault = vault.id

  const user = getOrCreateUser(event.params.account, timestamp)
  deposit.user = user.id
  user.depositsBalance = user.depositsBalance.plus(staked)
  user.totalBalance = user.totalBalance.plus(staked)
  updateUser(user, timestamp)

  const vub = getOrCreateVaultUserBalance(vault, user, timestamp)
  const oldStaked = vub.staked
  vub.staked = vub.staked.plus(staked)
  vub.amount = vub.amount.plus(amount)
  vub.value = vub.value.plus(staked.times(tokenPrice))
  vub.token = token.id
  updateVaultUserBalance(vub, timestamp)

  vault.tvlUSD = vault.tvl.times(tokenPrice)
  if (oldStaked == BIG_DECIMAL_0) {
    vault.userCount = vault.userCount.plus(BIG_INT_1)
  }
  saveVault(vault, timestamp)

  const vaultGroup = getVaultGroup(vault.name)
  vaultGroup.tvlUSD = vaultGroup.tvl.times(tokenPrice)
  vaultGroup.volume = vaultGroup.volume.plus(amount)
  vaultGroup.volumeUSD = vaultGroup.volumeUSD.plus(amount.times(tokenPrice))
  saveVaultGroup(vaultGroup, timestamp)

  const metric = getMetric()
  metric.tvl = vaultGroup.tvl
  metric.tvlUSD = vaultGroup.tvlUSD
  metric.volume = metric.volume.plus(amount)
  metric.volumeUSD = metric.volumeUSD.plus(amount.times(tokenPrice))
  updateMetric(metric, timestamp)

  deposit.amount = amount
  deposit.staked = staked
  deposit.value = staked.times(tokenPrice)
  deposit.save()

  return deposit as Deposit
}

export function getDeposit(eth_transaction: ethereum.Transaction): Deposit {
  const deposit = Deposit.load(eth_transaction.hash.toHexString())

  return deposit as Deposit
}
