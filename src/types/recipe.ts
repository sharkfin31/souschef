export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string;
  imageUrl: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: string[];
  createdAt: string;
}

export interface Ingredient {
  id?: string;
  recipeId?: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  notes: string | null;
}

export interface Instruction {
  id?: string;
  recipeId?: string;
  stepNumber: number;
  description: string;
}

export interface ParsedRecipe {
  title: string;
  description?: string;
  imageUrl?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags?: string[];
}

export interface GroceryList {
  id: string;
  name: string;
  items: GroceryItem[];
  createdAt: string;
  isMaster?: boolean;
}

export interface GroceryItem {
  id?: string;
  listId?: string;
  ingredientId?: string | null;
  name: string;
  quantity: string | null;
  unit: string | null;
  completed: boolean;
  recipeId?: string | null;
  recipeTitle?: string | null;
}
