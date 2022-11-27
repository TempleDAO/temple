import env from 'constants/env';

export enum TEAM_PAYMENTS_EPOCHS {
  R1 = 0,
  R2 = 1,
  R3 = 2,
  R4 = 3,
  R5 = 4,
  R6 = 5,
  R7 = 6,
  R8 = 7,
  R9 = 8,
}

export const TEAM_PAYMENTS_FIXED_ADDRESSES_BY_EPOCH = {
  [TEAM_PAYMENTS_EPOCHS.R1]: env.contracts.teamPaymentsEpoch1,
  [TEAM_PAYMENTS_EPOCHS.R2]: env.contracts.teamPaymentsEpoch2,
  [TEAM_PAYMENTS_EPOCHS.R3]: env.contracts.teamPaymentsEpoch3,
  [TEAM_PAYMENTS_EPOCHS.R4]: env.contracts.teamPaymentsEpoch4,
  [TEAM_PAYMENTS_EPOCHS.R5]: env.contracts.teamPaymentsEpoch5,
  [TEAM_PAYMENTS_EPOCHS.R6]: env.contracts.teamPaymentsEpoch6,
  [TEAM_PAYMENTS_EPOCHS.R7]: env.contracts.teamPaymentsEpoch7,
  [TEAM_PAYMENTS_EPOCHS.R8]: env.contracts.teamPaymentsEpoch8,
  [TEAM_PAYMENTS_EPOCHS.R9]: env.contracts.teamPaymentsEpoch9,
};
