// Re-export from modular structure
import { recipeService } from './recipe';

export const getRecipes = recipeService.getRecipes;
export const getRecipeById = recipeService.getRecipeById;
export const getIngredientsByRecipeId = recipeService.getIngredientsByRecipeId;
export const getInstructionsByRecipeId = recipeService.getInstructionsByRecipeId;
export const createRecipe = recipeService.createRecipe;
export const updateRecipeTags = recipeService.updateRecipeTags;
export const updateRecipeTitle = recipeService.updateRecipeTitle;
