import { RelicItemData } from 'providers/types';
import { intersection, isEqual } from 'lodash';

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
  { id: 3, required_ids: [0, 1, 2], required_amounts: [1, 2, 1], reward_ids: [3], reward_amounts: [1] },
];

export const getValidRecipe = (items: RelicItemData[]): Recipe | null => {
  if (!items) return null;
  const inputItemIds = items.map((item) => item.id);
  const inputItemCounts = items.map((item) => item.count);

  const matchingRecipesByIds = RECIPES.filter((recipe) => {
    const sameIds = intersection(recipe.required_ids, inputItemIds);
    return sameIds.length === recipe.required_ids.length;
  });

  const matchingRecipesByCountsAndIds = matchingRecipesByIds.filter((recipe) => {
    for (let item of items) {
      const idInRecipe = recipe.required_ids.indexOf(item.id);
      if (recipe.required_amounts[idInRecipe] !== item.count) {
        return false;
      }
    }
    return true;
  });

  if (matchingRecipesByCountsAndIds.length === -1) {
    console.log('no matching recipes');
    return null;
  }

  return matchingRecipesByCountsAndIds[0];
};
