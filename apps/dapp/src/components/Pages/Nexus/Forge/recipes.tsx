import { RelicItemData } from 'providers/types';
import { difference, isEqual } from 'lodash';

export type Recipe = {
  id: number;
  required_ids: number[];
  required_amounts: number[];
  reward_ids: number[];
  reward_amounts: number[];
};

const RECIPES: Recipe[] = [
  { id: 0, required_ids: [0, 1], required_amounts: [1, 1], reward_ids: [2], reward_amounts: [1] },
  { id: 2, required_ids: [0, 1], required_amounts: [2, 3], reward_ids: [2], reward_amounts: [1] },
];

export const getValidRecipe = (data: RelicItemData[]): Recipe | null => {
  const inputItemIds = data.map((item) => item.id);
  const inputItemCounts = data.map((item) => item.count);

  const matchingRecipes = RECIPES.filter((recipe) => {
    const sameIds = isEqual(recipe.required_ids, inputItemIds);
    const sameCounts = isEqual(recipe.required_amounts, inputItemCounts);
    return sameIds && sameCounts;
  });

  if (matchingRecipes.length === -1) {
    console.log('no matching recipes');
    return null;
  }

  return matchingRecipes[0];
};
