export type Recipe = {
  id: number;
  required_ids: number[];
  required_amounts: number[];
  reward_ids: number[];
  reward_amounts: number[];
};

export enum RARITY_TYPE {
  LOW,
  MEDIUM,
  EPIC,
}

export type Shard = {
  id: number;
  name: string;
  description: string;
  originUrl: string;
  logoUrl: string;
  rarity: RARITY_TYPE;
};

export type QuestData = {
  id: string;
  title: string;
  origin: string;
  linkUrl: string;
  description: string;
  logoUrl: string;
  rewardIds: number[];
  rarity: RARITY_TYPE;
};
