import { Recipe } from '../../types/recipe';
import { apiClient } from './apiClient';

const USE_MOCK_DATA = false;

const IMPORT_POLL_MS = 700;
const IMPORT_MAX_WAIT_MS = 12 * 60 * 1000;

const INGREDIENT_NORMALIZATION_INSTRUCTIONS = `
      When extracting ingredients, please normalize units and ingredient names:
      1. Normalize units: treat similar units as the same (e.g., 'g', 'gm', 'gram', 'grams' should all be 'g').
      2. Normalize ingredient names: remove unnecessary descriptors (e.g., 'fresh coriander', 'coriander leaves', 'coriander bunch' should all be 'coriander').
      3. Be consistent with units: use standard abbreviations where possible (g, kg, ml, l, tbsp, tsp, cup).
      4. Remove qualifiers like 'fresh', 'dried', 'chopped', etc. from ingredient names unless they significantly change the ingredient.
    `;

export type ImportJobSnapshot = {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stage: string;
  stage_label: string;
  percent: number;
  result?: Record<string, unknown> | null;
  error?: string | null;
};

function unwrapStartJob(res: unknown): string {
  const r = res as { data?: { job_id?: string }; job_id?: string };
  const id = r?.data?.job_id ?? r?.job_id;
  if (!id) {
    throw new Error('Server did not return an import job id');
  }
  return id;
}

function unwrapJobPoll(res: unknown): ImportJobSnapshot {
  const r = res as { data?: ImportJobSnapshot };
  const row = r?.data ?? (res as ImportJobSnapshot);
  if (!row?.job_id || !row?.status) {
    throw new Error('Invalid import job response from server');
  }
  return row as ImportJobSnapshot;
}

async function pollImportJob(
  jobId: string,
  onProgress?: (snapshot: ImportJobSnapshot) => void
): Promise<ImportJobSnapshot> {
  const deadline = Date.now() + IMPORT_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const raw = await apiClient.get(`/import-jobs/${jobId}`);
    const snap = unwrapJobPoll(raw);
    onProgress?.(snap);
    if (snap.status === 'completed' || snap.status === 'failed') {
      return snap;
    }
    await new Promise((resolve) => setTimeout(resolve, IMPORT_POLL_MS));
  }
  throw new Error('Import timed out while waiting for the server.');
}

/**
 * Mock response for testing frontend logic
 */
const getMockResponse = () => ({
  success: true,
  message: 'Recipe extracted successfully (MOCK DATA)',
  data: {
    recipe_id: 'mock-recipe-123',
    title: 'Mock Chocolate Chip Cookies',
    description:
      'Delicious homemade chocolate chip cookies that are crispy on the outside and chewy on the inside.',
    prep_time: 15,
    prepTime: 15,
    cook_time: 12,
    cookTime: 12,
    total_time: 27,
    servings: 24,
    difficulty: 'Easy',
    source_url: 'https://example.com/mock-recipe',
    post_url: 'https://example.com/mock-recipe',
    image_url: 'https://via.placeholder.com/400x300/8B4513/FFFFFF?text=Mock+Recipe+Image',
    video_url: null as string | null,
    source: 'mock',
    extracted_via: 'mock',
    ingredients: [
      { name: 'flour', quantity: '2.25', unit: 'cup' },
      { name: 'butter', quantity: '1', unit: 'cup' },
      { name: 'brown sugar', quantity: '0.75', unit: 'cup' },
      { name: 'white sugar', quantity: '0.75', unit: 'cup' },
      { name: 'eggs', quantity: '2', unit: null },
      { name: 'vanilla extract', quantity: '2', unit: 'tsp' },
      { name: 'baking soda', quantity: '1', unit: 'tsp' },
      { name: 'salt', quantity: '1', unit: 'tsp' },
      { name: 'chocolate chips', quantity: '2', unit: 'cup' },
    ],
    instructions: [
      { stepNumber: 1, step_number: 1, description: 'Preheat oven to 375°F (190°C).', timeEstimate: 5 },
      {
        stepNumber: 2,
        step_number: 2,
        description: 'In a large bowl, cream together butter and both sugars until light and fluffy.',
        timeEstimate: 3,
      },
      { stepNumber: 3, step_number: 3, description: 'Beat in eggs one at a time, then add vanilla extract.', timeEstimate: 2 },
      {
        stepNumber: 4,
        step_number: 4,
        description: 'In a separate bowl, whisk together flour, baking soda, and salt.',
        timeEstimate: 2,
      },
      {
        stepNumber: 5,
        step_number: 5,
        description: 'Gradually mix the flour mixture into the wet ingredients until just combined.',
        timeEstimate: 2,
      },
      { stepNumber: 6, step_number: 6, description: 'Fold in chocolate chips.', timeEstimate: 1 },
      {
        stepNumber: 7,
        step_number: 7,
        description: 'Drop rounded tablespoons of dough onto ungreased baking sheets.',
        timeEstimate: 5,
      },
      {
        stepNumber: 8,
        step_number: 8,
        description: 'Bake for 9-11 minutes or until golden brown around the edges.',
        timeEstimate: 12,
      },
      {
        stepNumber: 9,
        step_number: 9,
        description: 'Cool on baking sheet for 2 minutes before transferring to wire rack.',
        timeEstimate: 2,
      },
    ],
    tags: ['Dessert', 'Baking', 'American', 'Easy', 'Sweet', 'Family-friendly'],
    nutritionNotes: 'High in calories and sugar. Contains gluten and dairy.',
  },
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
  notes: null,
});

function mapExtractedPayloadToRecipe(recipeData: any): Recipe {
  if (!recipeData || !recipeData.recipe_id) {
    throw new Error('Invalid response from server: missing recipe data');
  }
  return {
    id: recipeData.recipe_id,
    title: recipeData.title || 'Untitled Recipe',
    description: recipeData.description || '',
    sourceUrl: recipeData.source_url || recipeData.post_url || '',
    imageUrl: recipeData.image_url || '',
    videoUrl: recipeData.video_url ?? null,
    ingredients: (recipeData.ingredients || []).map((ing: any) => processIngredient(ing, recipeData.recipe_id)),
    instructions: (recipeData.instructions || []).map((inst: any, index: number) => ({
      id: crypto.randomUUID(),
      recipeId: recipeData.recipe_id,
      stepNumber: inst.stepNumber || inst.step_number || index + 1,
      description: inst.description || '',
    })),
    prepTime: recipeData.prep_time ?? recipeData.prepTime ?? null,
    cookTime: recipeData.cook_time ?? recipeData.cookTime ?? null,
    servings: recipeData.servings ?? null,
    tags: recipeData.tags || ['Uncategorized'],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Extract recipe from URL (Instagram, website, or any supported URL).
 * Uses async import job + polling for server-driven progress.
 */
export const extractRecipeFromUrl = async (
  url: string,
  onProgress?: (job: ImportJobSnapshot) => void
): Promise<Recipe> => {
  if (USE_MOCK_DATA) {
    const response: any = await new Promise((resolve) => {
      setTimeout(() => resolve(getMockResponse()), 500);
    });
    return mapExtractedPayloadToRecipe(response?.data || response);
  }

  const start = await apiClient.post('/import-jobs/from-url', {
    url,
    instructions: INGREDIENT_NORMALIZATION_INSTRUCTIONS,
  });
  const jobId = unwrapStartJob(start);
  const finalJob = await pollImportJob(jobId, onProgress);
  if (finalJob.status === 'failed') {
    throw new Error(finalJob.error || 'Import failed');
  }
  const recipeData = finalJob.result;
  if (!recipeData || typeof recipeData !== 'object') {
    throw new Error('Import completed without recipe data');
  }
  return mapExtractedPayloadToRecipe(recipeData);
};

/**
 * Extract recipe from image
 */
export const extractRecipeFromImage = async (
  image: File,
  onProgress?: (job: ImportJobSnapshot) => void
): Promise<Recipe> => {
  return extractRecipeFromMultipleImages([image], onProgress);
};

/**
 * Extract recipe from multiple images
 */
export const extractRecipeFromMultipleImages = async (
  images: File[],
  onProgress?: (job: ImportJobSnapshot) => void
): Promise<Recipe> => {
  if (USE_MOCK_DATA) {
    const response: any = await new Promise((resolve) => {
      setTimeout(() => {
        const mockResponse = getMockResponse();
        mockResponse.data.title = 'Mock Recipe from Images';
        mockResponse.data.source_url = '';
        mockResponse.data.post_url = '';
        mockResponse.message = 'Recipe extracted from images successfully (MOCK DATA)';
        resolve(mockResponse);
      }, 2000);
    });
    return mapExtractedPayloadToRecipe(response?.data || response);
  }

  const formData = new FormData();
  images.forEach((image, index) => {
    const renamedFile = new File([image], `${index + 1}_${image.name}`, { type: image.type });
    formData.append('images', renamedFile);
  });
  formData.append('instructions', INGREDIENT_NORMALIZATION_INSTRUCTIONS);

  const start = await apiClient.postForm('/import-jobs/from-images', formData);
  const jobId = unwrapStartJob(start);
  const finalJob = await pollImportJob(jobId, onProgress);
  if (finalJob.status === 'failed') {
    throw new Error(finalJob.error || 'Import failed');
  }
  const recipeData = finalJob.result;
  if (!recipeData || typeof recipeData !== 'object') {
    throw new Error('Import completed without recipe data');
  }
  return mapExtractedPayloadToRecipe(recipeData);
};

/**
 * Extract recipe from PDF file
 */
export const extractRecipeFromPDF = async (
  pdf: File,
  onProgress?: (job: ImportJobSnapshot) => void
): Promise<Recipe> => {
  if (USE_MOCK_DATA) {
    const response: any = await new Promise((resolve) => {
      setTimeout(() => {
        const mockResponse = getMockResponse();
        mockResponse.data.title = 'Mock Recipe from PDF';
        mockResponse.data.source_url = '';
        mockResponse.data.post_url = '';
        mockResponse.message = 'Recipe extracted from PDF successfully (MOCK DATA)';
        resolve(mockResponse);
      }, 3000);
    });
    return mapExtractedPayloadToRecipe(response?.data || response);
  }

  const formData = new FormData();
  formData.append('pdf', pdf);
  formData.append('instructions', INGREDIENT_NORMALIZATION_INSTRUCTIONS);

  const start = await apiClient.postForm('/import-jobs/from-pdf', formData);
  const jobId = unwrapStartJob(start);
  const finalJob = await pollImportJob(jobId, onProgress);
  if (finalJob.status === 'failed') {
    throw new Error(finalJob.error || 'Import failed');
  }
  const recipeData = finalJob.result;
  if (!recipeData || typeof recipeData !== 'object') {
    throw new Error('Import completed without recipe data');
  }
  return mapExtractedPayloadToRecipe(recipeData);
};

/**
 * Extract recipe from raw text
 */
export const extractRecipeFromText = async (
  text: string,
  onProgress?: (job: ImportJobSnapshot) => void
): Promise<Recipe> => {
  if (USE_MOCK_DATA) {
    const response: any = await new Promise((resolve) => {
      setTimeout(() => {
        const mockResponse = getMockResponse();
        mockResponse.data.title = 'Mock Recipe from Text';
        mockResponse.data.source_url = '';
        mockResponse.data.post_url = '';
        mockResponse.message = 'Recipe extracted from text successfully (MOCK DATA)';
        resolve(mockResponse);
      }, 2000);
    });
    return mapExtractedPayloadToRecipe(response?.data || response);
  }

  const start = await apiClient.post('/import-jobs/from-text', {
    text,
    instructions: INGREDIENT_NORMALIZATION_INSTRUCTIONS,
  });
  const jobId = unwrapStartJob(start);
  const finalJob = await pollImportJob(jobId, onProgress);
  if (finalJob.status === 'failed') {
    throw new Error(finalJob.error || 'Import failed');
  }
  const recipeData = finalJob.result;
  if (!recipeData || typeof recipeData !== 'object') {
    throw new Error('Import completed without recipe data');
  }
  return mapExtractedPayloadToRecipe(recipeData);
};

export const recipeApi = {
  extractRecipeFromUrl,
  extractRecipeFromImage,
  extractRecipeFromMultipleImages,
  extractRecipeFromPDF,
  extractRecipeFromText,
};
