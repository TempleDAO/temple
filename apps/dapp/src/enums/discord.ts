export enum ENCLAVES {
  STRUCTURE = 'Structure',
  LOGIC = 'Logic',
  MYSTERY = 'Mystery',
  ORDER = 'Order',
  CHAOS = 'Chaos',
}

export enum ROLES {
  MASTER = 'Temple Masters',
  INITIATE = 'Temple Initiates',
  DISCIPLE = 'Temple Disciples',
  ACOLYTE = 'Acolytes',
  GUARDIAN = 'Guardians',
  FIRE_RITUAL = 'Fire Ritualists',
  OPENING_CEREMONY = 'Echoing Whispers',
  TEMPLAR = 'Templars',
}

export const ROLE_LABELS = {
  [ROLES.MASTER]: 'Master',
  [ROLES.INITIATE]: 'Initiate',
  [ROLES.DISCIPLE]: 'Disciple',
  [ROLES.ACOLYTE]: 'Acolyte',
  [ROLES.GUARDIAN]: 'Guardian',
  [ROLES.FIRE_RITUAL]: 'Ritualist',
  [ROLES.OPENING_CEREMONY]: '!Verified',
  [ROLES.TEMPLAR]: 'Templar',
  UNVERIFIED: '!Unverified',
};
