import { supabase } from '../../lib/supabase';
import { Recipe, ParsedRecipe, Ingredient, Instruction } from '../../types/recipe';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '../api/apiClient';

/**
 * Get all recipes for the current user
 */
export const getRecipes = async (): Promise<Recipe[]> => {
  try {
    // Try to get recipes from the backend API (which handles user authentication)
    const response = await apiClient.get('/recipes');
    
    if (response.user_specific && response.recipes) {
      // Backend returned user-specific recipes, format them for the frontend
      const recipesWithDetails = await Promise.all(
        response.recipes.map(async (recipe: any) => {
          const ingredients = await getIngredientsByRecipeId(recipe.id);
          const instructions = await getInstructionsByRecipeId(recipe.id);
          
          return {
            id: recipe.id,
            title: recipe.title,
            description: recipe.description,
            sourceUrl: recipe.source_url,
            imageUrl: recipe.image_url,
            prepTime: recipe.prep_time,
            cookTime: recipe.cook_time,
            servings: recipe.servings,
            ingredients,
            instructions,
            tags: recipe.tags || [],
            createdAt: recipe.created_at
          };
        })
      );
      
      return recipesWithDetails;
    } else {
      // Fallback to direct Supabase query for backward compatibility
      return await getRecipesFromSupabase();
    }
  } catch (error) {
    console.warn('Backend API not available, falling back to Supabase direct access:', error);
    // Fallback to direct Supabase access
    return await getRecipesFromSupabase();
  }
};

/**
 * Fallback method to get recipes directly from Supabase
 */
const getRecipesFromSupabase = async (): Promise<Recipe[]> => {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching recipes:', error);
    throw new Error('Failed to fetch recipes');
  }
  
  // Fetch ingredients and instructions for each recipe
  const recipesWithDetails = await Promise.all(
    data.map(async (recipe) => {
      const ingredients = await getIngredientsByRecipeId(recipe.id);
      const instructions = await getInstructionsByRecipeId(recipe.id);
      
      return {
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        sourceUrl: recipe.source_url,
        imageUrl: recipe.image_url,
        prepTime: recipe.prep_time,
        cookTime: recipe.cook_time,
        servings: recipe.servings,
        ingredients,
        instructions,
        tags: recipe.tags || [],
        createdAt: recipe.created_at
      };
    })
  );
  
  return recipesWithDetails;
};

/**
 * Get a recipe by ID
 */
export const getRecipeById = async (id: string): Promise<Recipe> => {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching recipe:', error);
    throw new Error('Failed to fetch recipe');
  }
  
  const ingredients = await getIngredientsByRecipeId(id);
  const instructions = await getInstructionsByRecipeId(id);
  
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    sourceUrl: data.source_url,
    imageUrl: data.image_url,
    prepTime: data.prep_time,
    cookTime: data.cook_time,
    servings: data.servings,
    ingredients,
    instructions,
    tags: data.tags || [],
    createdAt: data.created_at
  };
};

/**
 * Get ingredients by recipe ID
 */
export const getIngredientsByRecipeId = async (recipeId: string): Promise<Ingredient[]> => {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('recipe_id', recipeId);
  
  if (error) {
    console.error('Error fetching ingredients:', error);
    throw new Error('Failed to fetch ingredients');
  }
  
  return data.map(item => ({
    id: item.id,
    recipeId: item.recipe_id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    notes: item.notes
  }));
};

/**
 * Get instructions by recipe ID
 */
export const getInstructionsByRecipeId = async (recipeId: string): Promise<Instruction[]> => {
  const { data, error } = await supabase
    .from('instructions')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('step_number', { ascending: true });
  
  if (error) {
    console.error('Error fetching instructions:', error);
    throw new Error('Failed to fetch instructions');
  }
  
  return data.map(item => ({
    id: item.id,
    recipeId: item.recipe_id,
    stepNumber: item.step_number,
    description: item.description
  }));
};

/**
 * Create a new recipe
 */
/**
 * Update recipe tags
 */
export const updateRecipeTags = async (recipeId: string, tags: string[]): Promise<void> => {
  const { error } = await supabase
    .from('recipes')
    .update({ tags })
    .eq('id', recipeId);
  
  if (error) {
    console.error('Error updating recipe tags:', error);
    throw new Error('Failed to update recipe tags');
  }
};

/**
 * Update recipe title
 */
export const updateRecipeTitle = async (recipeId: string, title: string): Promise<void> => {
  const { error } = await supabase
    .from('recipes')
    .update({ title })
    .eq('id', recipeId);
  
  if (error) {
    console.error('Error updating recipe title:', error);
    throw new Error('Failed to update recipe title');
  }
};

/**
 * Create a new recipe
 */
export const createRecipe = async (parsedRecipe: ParsedRecipe, sourceUrl: string): Promise<Recipe> => {
  const recipeId = uuidv4();
  
  // Insert recipe
  const { error: recipeError } = await supabase
    .from('recipes')
    .insert({
      id: recipeId,
      title: parsedRecipe.title,
      description: parsedRecipe.description || null,
      source_url: sourceUrl,
      image_url: parsedRecipe.imageUrl || null,
      prep_time: parsedRecipe.prepTime || null,
      cook_time: parsedRecipe.cookTime || null,
      servings: parsedRecipe.servings || null,
      tags: parsedRecipe.tags || []
    });
  
  if (recipeError) {
    console.error('Error creating recipe:', recipeError);
    throw new Error('Failed to create recipe');
  }
  
  // Insert ingredients
  if (parsedRecipe.ingredients.length > 0) {
    const ingredientsToInsert = parsedRecipe.ingredients.map(ingredient => ({
      id: uuidv4(),
      recipe_id: recipeId,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      notes: ingredient.notes
    }));
    
    const { error: ingredientsError } = await supabase
      .from('ingredients')
      .insert(ingredientsToInsert);
    
    if (ingredientsError) {
      console.error('Error creating ingredients:', ingredientsError);
      throw new Error('Failed to create ingredients');
    }
  }
  
  // Insert instructions
  if (parsedRecipe.instructions.length > 0) {
    const instructionsToInsert = parsedRecipe.instructions.map(instruction => ({
      id: uuidv4(),
      recipe_id: recipeId,
      step_number: instruction.stepNumber,
      description: instruction.description
    }));
    
    const { error: instructionsError } = await supabase
      .from('instructions')
      .insert(instructionsToInsert);
    
    if (instructionsError) {
      console.error('Error creating instructions:', instructionsError);
      throw new Error('Failed to create instructions');
    }
  }
  
  // Return the created recipe
  return getRecipeById(recipeId);
};

/**
 * Delete a recipe and all its associated data (ingredients, instructions)
 */
export const deleteRecipe = async (recipeId: string): Promise<boolean> => {
  try {
    // First verify the recipe exists and belongs to the current user
    const { data: recipe, error: fetchError } = await supabase
      .from('recipes')
      .select('id, user_id')
      .eq('id', recipeId)
      .single();

    if (fetchError || !recipe) {
      console.error('Recipe not found or access denied:', fetchError);
      throw new Error('Recipe not found or you do not have permission to delete it');
    }

    // Delete the recipe - this will cascade delete ingredients and instructions
    // due to the foreign key constraints in the database
    const { error: deleteError } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId);

    if (deleteError) {
      console.error('Error deleting recipe:', deleteError);
      throw new Error('Failed to delete recipe');
    }

    return true;
  } catch (error) {
    console.error('Error in deleteRecipe:', error);
    throw error;
  }
};