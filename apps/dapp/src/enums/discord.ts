export enum Enclave {
  Structure = 'Structure',
  Logic = 'Logic',
  Mystery = 'Mystery',
  Order = 'Order',
  Chaos = 'Chaos',
}

export enum DiscordRole {
  TempleMasters = 'Temple Masters',
  TempleInitiates = 'Temple Initiates',
  TempleDisciples = 'Temple Disciples',
  Acolytes = 'Acolytes',
  Guardians = 'Guardians',
  FireRitualists = 'Fire Ritualists',
  EchoingWhispers = 'Echoing Whispers',
  Templar = 'Templars',
}

export const ROLE_LABELS = {
  [DiscordRole.TempleMasters]: 'Master',
  [DiscordRole.TempleInitiates]: 'Initiate',
  [DiscordRole.TempleDisciples]: 'Disciple',
  [DiscordRole.Acolytes]: 'Acolyte',
  [DiscordRole.Guardians]: 'Guardian',
  [DiscordRole.FireRitualists]: 'Ritualist',
  [DiscordRole.EchoingWhispers]: '!Verified',
  [DiscordRole.Templar]: 'Templar',
  UNVERIFIED: '!Unverified',
};
