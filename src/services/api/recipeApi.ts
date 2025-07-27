import { Recipe } from '../../types/recipe';
import { apiClient } from './apiClient';

// Set to false to use real API calls instead of mock data
const USE_MOCK_DATA = false;

/**
 * Mock response for testing frontend logic
 */
const getMockResponse = () => ({
  success: true,
  message: "Recipe extracted successfully (MOCK DATA)",
  data: {
    recipe_id: "mock-recipe-123",
    title: "Mock Chocolate Chip Cookies",
    description: "Delicious homemade chocolate chip cookies that are crispy on the outside and chewy on the inside.",
    prep_time: 15,
    prepTime: 15,
    cook_time: 12,
    cookTime: 12,
    total_time: 27,
    servings: 24,
    difficulty: "Easy",
    source_url: "https://example.com/mock-recipe",
    post_url: "https://example.com/mock-recipe",
    image_url: "https://via.placeholder.com/400x300/8B4513/FFFFFF?text=Mock+Recipe+Image",
    source: "mock",
    extracted_via: "mock",
    ingredients: [
      {
        name: "flour",
        quantity: "2.25",
        unit: "cup"
      },
      {
        name: "butter",
        quantity: "1",
        unit: "cup"
      },
      {
        name: "brown sugar",
        quantity: "0.75",
        unit: "cup"
      },
      {
        name: "white sugar",
        quantity: "0.75",
        unit: "cup"
      },
      {
        name: "eggs",
        quantity: "2",
        unit: null
      },
      {
        name: "vanilla extract",
        quantity: "2",
        unit: "tsp"
      },
      {
        name: "baking soda",
        quantity: "1",
        unit: "tsp"
      },
      {
        name: "salt",
        quantity: "1",
        unit: "tsp"
      },
      {
        name: "chocolate chips",
        quantity: "2",
        unit: "cup"
      }
    ],
    instructions: [
      {
        stepNumber: 1,
        step_number: 1,
        description: "Preheat oven to 375°F (190°C).",
        timeEstimate: 5
      },
      {
        stepNumber: 2,
        step_number: 2,
        description: "In a large bowl, cream together butter and both sugars until light and fluffy.",
        timeEstimate: 3
      },
      {
        stepNumber: 3,
        step_number: 3,
        description: "Beat in eggs one at a time, then add vanilla extract.",
        timeEstimate: 2
      },
      {
        stepNumber: 4,
        step_number: 4,
        description: "In a separate bowl, whisk together flour, baking soda, and salt.",
        timeEstimate: 2
      },
      {
        stepNumber: 5,
        step_number: 5,
        description: "Gradually mix the flour mixture into the wet ingredients until just combined.",
        timeEstimate: 2
      },
      {
        stepNumber: 6,
        step_number: 6,
        description: "Fold in chocolate chips.",
        timeEstimate: 1
      },
      {
        stepNumber: 7,
        step_number: 7,
        description: "Drop rounded tablespoons of dough onto ungreased baking sheets.",
        timeEstimate: 5
      },
      {
        stepNumber: 8,
        step_number: 8,
        description: "Bake for 9-11 minutes or until golden brown around the edges.",
        timeEstimate: 12
      },
      {
        stepNumber: 9,
        step_number: 9,
        description: "Cool on baking sheet for 2 minutes before transferring to wire rack.",
        timeEstimate: 2
      }
    ],
    tags: ["Dessert", "Baking", "American", "Easy", "Sweet", "Family-friendly"],
    nutritionNotes: "High in calories and sugar. Contains gluten and dairy."
  }
});

/**
 * Process ingredient to ensure quantity is a string
 */
const processIngredient = (ing: any, recipeId: string) => ({
  id: crypto.randomUUID(),
  recipeId,
  name: ing?.name || 'Unknown ingredient',
  quantity: ing?.quantity?.toString() || null,
  unit: ing?.unit || null,
  notes: null
});

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
  
  // Handle nested response structure - extract the actual recipe data
  const recipeData = response?.data || response;
  
  // Validate response structure
  if (!recipeData || !recipeData.recipe_id) {
    console.error('❌ Invalid response structure:', response);
    throw new Error('Invalid response from server: missing recipe data');
  }
  
  // Format the recipe data for our app (handle both Instagram and web URL responses)
  const formattedRecipe = {
    id: recipeData.recipe_id,
    title: recipeData.title || 'Untitled Recipe',
    description: recipeData.description || '',
    sourceUrl: recipeData.source_url || recipeData.post_url || '',
    imageUrl: recipeData.image_url || '',
    ingredients: (recipeData.ingredients || []).map((ing: any) => processIngredient(ing, recipeData.recipe_id)),
    instructions: (recipeData.instructions || []).map((inst: any, index: number) => ({
      id: crypto.randomUUID(),
      recipeId: recipeData.recipe_id,
      stepNumber: inst.stepNumber || inst.step_number || (index + 1),
      description: inst.description || ''
    })),
    prepTime: recipeData.prep_time ?? recipeData.prepTime ?? null,
    cookTime: recipeData.cook_time ?? recipeData.cookTime ?? null,
    servings: recipeData.servings ?? null,
    tags: recipeData.tags || ['Uncategorized'],
    createdAt: new Date().toISOString()
  };
  
  return formattedRecipe;
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
  
  const response = USE_MOCK_DATA 
    ? await new Promise(resolve => {
        setTimeout(() => {
          const mockResponse = getMockResponse();
          mockResponse.data.title = "Mock Recipe from Images";
          mockResponse.data.source_url = "";
          mockResponse.data.post_url = "";
          mockResponse.message = "Recipe extracted from images successfully (MOCK DATA)";
          resolve(mockResponse);
        }, 2000);
      })
    : await apiClient.postForm('/extract-images', formData);
  
  // Handle nested response structure - extract the actual recipe data
  const recipeData = response?.data || response;
  
  // Validate response structure
  if (!recipeData || !recipeData.recipe_id) {
    console.error('❌ Invalid image response structure:', response);
    throw new Error('Invalid response from server: missing recipe data');
  }
  
  // Format the recipe data for our app
  return {
    id: recipeData.recipe_id,
    title: recipeData.title || 'Untitled Recipe',
    description: recipeData.description || '',
    sourceUrl: '',
    imageUrl: recipeData.image_url || '',
    ingredients: (recipeData.ingredients || []).map((ing: any) => processIngredient(ing, recipeData.recipe_id)),
    instructions: (recipeData.instructions || []).map((inst: any, index: number) => ({
      id: crypto.randomUUID(),
      recipeId: recipeData.recipe_id,
      stepNumber: inst.stepNumber || (index + 1),
      description: inst.description || ''
    })),
    prepTime: recipeData.prepTime ?? null,
    cookTime: recipeData.cookTime ?? null,
    servings: recipeData.servings ?? null,
    tags: recipeData.tags || ['Uncategorized'],
    createdAt: new Date().toISOString()
  };
};

/**
 * Extract recipe from PDF file
 */
export const extractRecipeFromPDF = async (pdf: File): Promise<Recipe> => {
  const formData = new FormData();
  formData.append('pdf', pdf);
  
  // Add instructions for AI processing
  formData.append('instructions', `
    When extracting ingredients, please normalize units and ingredient names:
    1. Normalize units: treat similar units as the same (e.g., 'g', 'gm', 'gram', 'grams' should all be 'g').
    2. Normalize ingredient names: remove unnecessary descriptors (e.g., 'fresh coriander', 'coriander leaves', 'coriander bunch' should all be 'coriander').
    3. Be consistent with units: use standard abbreviations where possible (g, kg, ml, l, tbsp, tsp, cup).
    4. Remove qualifiers like 'fresh', 'dried', 'chopped', etc. from ingredient names unless they significantly change the ingredient.
  `);
  
  const response = USE_MOCK_DATA 
    ? await new Promise(resolve => {
        setTimeout(() => {
          const mockResponse = getMockResponse();
          mockResponse.data.title = "Mock Recipe from PDF";
          mockResponse.data.source_url = "";
          mockResponse.data.post_url = "";
          mockResponse.message = "Recipe extracted from PDF successfully (MOCK DATA)";
          resolve(mockResponse);
        }, 3000);
      })
    : await apiClient.postForm('/extract-pdf', formData);
  
  // Handle nested response structure - extract the actual recipe data
  const recipeData = response?.data || response;
  
  // Validate response structure
  if (!recipeData || !recipeData.recipe_id) {
    console.error('❌ Invalid PDF response structure:', response);
    throw new Error('Invalid response from server: missing recipe data');
  }
  
  // Format the recipe data for our app
  return {
    id: recipeData.recipe_id,
    title: recipeData.title || 'Untitled Recipe',
    description: recipeData.description || '',
    sourceUrl: '',
    imageUrl: recipeData.image_url || '',
    ingredients: (recipeData.ingredients || []).map((ing: any) => processIngredient(ing, recipeData.recipe_id)),
    instructions: (recipeData.instructions || []).map((inst: any, index: number) => ({
      id: crypto.randomUUID(),
      recipeId: recipeData.recipe_id,
      stepNumber: inst.stepNumber || (index + 1),
      description: inst.description || ''
    })),
    prepTime: recipeData.prepTime ?? null,
    cookTime: recipeData.cookTime ?? null,
    servings: recipeData.servings ?? null,
    tags: recipeData.tags || ['Uncategorized'],
    createdAt: new Date().toISOString()
  };
};

export const recipeApi = {
  extractRecipeFromUrl,
  extractRecipeFromImage,
  extractRecipeFromMultipleImages,
  extractRecipeFromPDF
};
