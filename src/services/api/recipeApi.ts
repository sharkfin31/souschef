import { Recipe } from '../../types/recipe';
import { apiClient } from './apiClient';

/**
 * Process ingredient to ensure quantity is a string
 */
const processIngredient = (ing: any, recipeId: string) => ({
  id: crypto.randomUUID(),
  recipeId,
  name: ing.name,
  quantity: ing.quantity?.toString() || null,
  unit: ing.unit || null,
  notes: null
});

/**
 * Generate recipe tags based on ingredients and title
 */
const generateRecipeTags = (recipe: any): string[] => {
  const tags: string[] = [];
  const title = recipe.title.toLowerCase();
  const ingredients = recipe.ingredients.map((ing: any) => ing.name.toLowerCase());
  const allText = title + ' ' + ingredients.join(' ');
  
  // Cuisine tags
  const cuisines = [
    'Italian', 'Mexican', 'Chinese', 'Indian', 'Japanese', 'Thai', 
    'Mediterranean', 'French', 'Greek', 'Spanish', 'Korean', 'Vietnamese',
    'American', 'Middle Eastern', 'Caribbean', 'African'
  ];
  
  cuisines.forEach(cuisine => {
    if (title.includes(cuisine.toLowerCase()) || 
      ingredients.some((ing: string) => ing.includes(cuisine.toLowerCase()))) {
      tags.push(cuisine);
    }
  });
  
  // Dietary tags
  if (!ingredients.some((ing: string) => [
    'meat', 'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon',
    'sausage', 'ham', 'prosciutto', 'veal', 'duck', 'goose'
  ].some(meat => ing.includes(meat)))) {
    tags.push('Vegetarian');
    
    // Check for vegan (no animal products)
    if (!ingredients.some((ing: string) => [
      'milk', 'cheese', 'cream', 'butter', 'yogurt', 'egg', 'honey',
      'mayonnaise', 'gelatin'
    ].some(animal => ing.includes(animal)))) {
      tags.push('Vegan');
    }
  }
  
  // Meal type tags
  const mealTypes = [
    { name: 'Breakfast', keywords: ['breakfast', 'pancake', 'waffle', 'oatmeal', 'cereal'] },
    { name: 'Lunch', keywords: ['lunch', 'sandwich', 'wrap', 'salad'] },
    { name: 'Dinner', keywords: ['dinner', 'roast', 'steak', 'casserole'] },
    { name: 'Dessert', keywords: ['dessert', 'cake', 'cookie', 'pie', 'ice cream', 'chocolate', 'sweet'] },
    { name: 'Snack', keywords: ['snack', 'dip', 'chips', 'popcorn'] },
    { name: 'Appetizer', keywords: ['appetizer', 'starter', 'finger food', 'hors d\'oeuvre'] },
    { name: 'Side Dish', keywords: ['side', 'accompaniment'] },
    { name: 'Soup', keywords: ['soup', 'stew', 'broth', 'chowder'] },
    { name: 'Salad', keywords: ['salad'] },
    { name: 'Drink', keywords: ['drink', 'beverage', 'cocktail', 'smoothie', 'juice'] },
    { name: 'Baking', keywords: ['bread', 'muffin', 'bake', 'pastry', 'dough'] }
  ];
  
  mealTypes.forEach(type => {
    if (type.keywords.some(keyword => allText.includes(keyword))) {
      tags.push(type.name);
    }
  });
  
  // Add any tags from the AI response if available
  if (recipe.tags && Array.isArray(recipe.tags)) {
    recipe.tags.forEach((tag: string) => {
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    });
  }
  
  return tags.length > 0 ? tags : ['Uncategorized'];
};

/**
 * Extract recipe from URL (Instagram, website, or any supported URL)
 */
export const extractRecipeFromUrl = async (url: string): Promise<Recipe> => {
  const response = await apiClient.post('/extract', { 
    url,
    instructions: `
      When extracting ingredients, please normalize units and ingredient names:
      1. Normalize units: treat similar units as the same (e.g., 'g', 'gm', 'gram', 'grams' should all be 'g').
      2. Normalize ingredient names: remove unnecessary descriptors (e.g., 'fresh coriander', 'coriander leaves', 'coriander bunch' should all be 'coriander').
      3. Be consistent with units: use standard abbreviations where possible (g, kg, ml, l, tbsp, tsp, cup).
      4. Remove qualifiers like 'fresh', 'dried', 'chopped', etc. from ingredient names unless they significantly change the ingredient.
    `
  });
  
  // Generate tags based on recipe content
  const tags = generateRecipeTags(response);
  
  // Format the recipe data for our app (handle both Instagram and web URL responses)
  return {
    id: response.recipe_id,
    title: response.title,
    description: response.description || '',
    sourceUrl: response.source_url || response.post_url || '',
    imageUrl: response.image_url,
    ingredients: response.ingredients.map((ing: any) => processIngredient(ing, response.recipe_id)),
    instructions: response.instructions.map((inst: any) => ({
      id: crypto.randomUUID(),
      recipeId: response.recipe_id,
      stepNumber: inst.stepNumber || inst.step_number,
      description: inst.description
    })),
    prepTime: response.prep_time ?? response.prepTime ?? null,
    cookTime: response.cook_time ?? response.cookTime ?? null,
    servings: response.servings ?? null,
    tags,
    createdAt: new Date().toISOString()
  };
};

/**
 * Extract recipe from image
 */
export const extractRecipeFromImage = async (image: File): Promise<Recipe> => {
  // Use the multiple images endpoint with a single image
  return extractRecipeFromMultipleImages([image]);
};

/**
 * Extract recipe from multiple images
 */
export const extractRecipeFromMultipleImages = async (images: File[]): Promise<Recipe> => {
  const formData = new FormData();
  
  // Append each image to the form data with the same field name
  // The order of appending is important and will be preserved on the server
  images.forEach((image, index) => {
    // Add index to filename to ensure order is preserved
    const renamedFile = new File([image], `${index+1}_${image.name}`, { type: image.type });
    formData.append('images', renamedFile);
  });
  
  // Add instructions for ingredient normalization
  formData.append('instructions', `
    When extracting ingredients, please normalize units and ingredient names:
    1. Normalize units: treat similar units as the same (e.g., 'g', 'gm', 'gram', 'grams' should all be 'g').
    2. Normalize ingredient names: remove unnecessary descriptors (e.g., 'fresh coriander', 'coriander leaves', 'coriander bunch' should all be 'coriander').
    3. Be consistent with units: use standard abbreviations where possible (g, kg, ml, l, tbsp, tsp, cup).
    4. Remove qualifiers like 'fresh', 'dried', 'chopped', etc. from ingredient names unless they significantly change the ingredient.
  `);
  
  const response = await apiClient.postForm('/extract-images', formData);
  
  // Generate tags based on recipe content
  const tags = generateRecipeTags(response);
  
  // Format the recipe data for our app
  return {
    id: response.recipe_id,
    title: response.title,
    description: response.description || '',
    sourceUrl: '',
    imageUrl: response.image_url,
    ingredients: response.ingredients.map((ing: any) => processIngredient(ing, response.recipe_id)),
    instructions: response.instructions.map((inst: any) => ({
      id: crypto.randomUUID(),
      recipeId: response.recipe_id,
      stepNumber: inst.stepNumber,
      description: inst.description
    })),
    prepTime: response.prepTime ?? null,
    cookTime: response.cookTime ?? null,
    servings: response.servings ?? null,
    tags,
    createdAt: new Date().toISOString()
  };
};

export const recipeApi = {
  extractRecipeFromUrl,
  extractRecipeFromImage,
  extractRecipeFromMultipleImages
};