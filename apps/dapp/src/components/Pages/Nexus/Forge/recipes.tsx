import { RelicItemData } from 'providers/types';
import { intersection } from 'lodash';
import { Recipe } from '../types';
import env from '../../../../constants/env';

export const getValidRecipe = (items: RelicItemData[]): Recipe | null => {
  if (!items) return null;
  const inputItemIds = items.map((item) => item.id);

  const matchingRecipesByIds = env.nexus.recipes.filter((recipe) => {
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
