import { Deposit, Withdraw } from '../../generated/OpsManager/Vault'

import { createDeposit } from '../entities/deposit'
import { createWithdraw } from '../entities/withdraw'


export function onDeposit(event: Deposit): void {
    createDeposit(event)
}

export function onWithdraw(event: Withdraw): void {
    createWithdraw(event)
}
