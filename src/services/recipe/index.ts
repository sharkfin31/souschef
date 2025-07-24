import { getRecipes, getRecipeById, getIngredientsByRecipeId, getInstructionsByRecipeId, createRecipe, updateRecipeTags, updateRecipeTitle } from './recipeService';

export const recipeService = {
  getRecipes,
  getRecipeById,
  getIngredientsByRecipeId,
  getInstructionsByRecipeId,
  createRecipe,
  updateRecipeTags,
  updateRecipeTitle
};

export default recipeService;