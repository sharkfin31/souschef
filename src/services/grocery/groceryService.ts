import { supabase } from '../../lib/supabase';
import { GroceryList, GroceryItem, Ingredient } from '../../types/recipe';
import { v4 as uuidv4 } from 'uuid';

// Helper function to normalize ingredient names
const normalizeIngredientName = (name: string): string => {
  // Convert to lowercase
  let normalized = name.toLowerCase();
  
  // Remove common prefixes/suffixes
  const prefixesToRemove = ['fresh ', 'dried ', 'frozen ', 'chopped ', 'sliced ', 'diced ', 'minced ', 'whole '];
  const suffixesToRemove = [' leaves', ' bunch', ' bunches', ' stalk', ' stalks', ' sprig', ' sprigs', ' clove', ' cloves'];
  
  prefixesToRemove.forEach(prefix => {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length);
    }
  });
  
  suffixesToRemove.forEach(suffix => {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, normalized.length - suffix.length);
    }
  });
  
  return normalized.trim();
};

// Helper function to normalize units
const normalizeUnit = (unit: string | null): string | null => {
  if (!unit) return null;
  
  const unitMap: Record<string, string> = {
    'g': 'g',
    'gm': 'g',
    'gram': 'g',
    'grams': 'g',
    'kg': 'kg',
    'kilo': 'kg',
    'kilos': 'kg',
    'kilogram': 'kg',
    'kilograms': 'kg',
    'ml': 'ml',
    'milliliter': 'ml',
    'milliliters': 'ml',
    'millilitre': 'ml',
    'millilitres': 'ml',
    'l': 'l',
    'liter': 'l',
    'liters': 'l',
    'litre': 'l',
    'litres': 'l',
    'oz': 'oz',
    'ounce': 'oz',
    'ounces': 'oz',
    'lb': 'lb',
    'lbs': 'lb',
    'pound': 'lb',
    'pounds': 'lb',
    'tbsp': 'tbsp',
    'tablespoon': 'tbsp',
    'tablespoons': 'tbsp',
    'tsp': 'tsp',
    'teaspoon': 'tsp',
    'teaspoons': 'tsp',
    'cup': 'cup',
    'cups': 'cup'
  };
  
  const normalizedUnit = unit.toLowerCase().trim();
  return unitMap[normalizedUnit] || normalizedUnit;
};

// Helper function to generate a unique key for an ingredient
const getIngredientKey = (name: string, unit: string | null) => {
  const normalizedName = normalizeIngredientName(name);
  const normalizedUnit = normalizeUnit(unit);
  return `${normalizedName}|${normalizedUnit || ''}`;
};

/**
 * Get all grocery lists
 */
export const getGroceryLists = async (): Promise<GroceryList[]> => {
  const { data, error } = await supabase
    .from('grocery_lists')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching grocery lists:', error);
    throw new Error('Failed to fetch grocery lists');
  }
  
  // Fetch items for each list
  const listsWithItems = await Promise.all(
    data.map(async (list) => {
      const items = await getGroceryItemsByListId(list.id);
      
      // Mark the master list based on name
      const isMaster = list.name === 'Master Grocery List';
      
      return {
        id: list.id,
        name: list.name,
        items,
        createdAt: list.created_at,
        isMaster
      };
    })
  );
  
  // Sort lists: master list first, then by creation date (newest first)
  listsWithItems.sort((a, b) => {
    if (a.isMaster) return -1;
    if (b.isMaster) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  
  return listsWithItems;
};

/**
 * Get a grocery list by ID
 */
export const getGroceryListById = async (id: string): Promise<GroceryList> => {
  const { data, error } = await supabase
    .from('grocery_lists')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching grocery list:', error);
    throw new Error('Failed to fetch grocery list');
  }
  
  const items = await getGroceryItemsByListId(id);
  
  // Check if this is the master list
  const isMaster = data.name === 'Master Grocery List';
  
  return {
    id: data.id,
    name: data.name,
    items,
    createdAt: data.created_at,
    isMaster
  };
};

/**
 * Get grocery items by list ID
 */
export const getGroceryItemsByListId = async (listId: string): Promise<GroceryItem[]> => {
  const { data, error } = await supabase
    .from('grocery_items')
    .select('*')
    .eq('list_id', listId);
  
  if (error) {
    console.error('Error fetching grocery items:', error);
    throw new Error('Failed to fetch grocery items');
  }
  
  return data.map(item => ({
    id: item.id,
    listId: item.list_id,
    ingredientId: item.ingredient_id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    completed: item.completed,
    recipeId: item.recipe_id || null,
    recipeTitle: item.recipe_title || null
  }));
};

/**
 * Get or create the master grocery list
 */
export const getMasterGroceryList = async (): Promise<GroceryList> => {
  // Check if master list exists (using name as identifier)
  const { data, error } = await supabase
    .from('grocery_lists')
    .select('*')
    .eq('name', 'Master Grocery List')
    .limit(1);
  
  if (error) {
    console.error('Error fetching master list:', error);
    throw new Error('Failed to fetch master list');
  }
  
  // If master list exists, return it with items
  if (data && data.length > 0) {
    const items = await getGroceryItemsByListId(data[0].id);
    return {
      id: data[0].id,
      name: data[0].name,
      items,
      createdAt: data[0].created_at,
      isMaster: true
    };
  }
  
  // Create master list if it doesn't exist
  const masterListId = uuidv4();
  const { error: createError } = await supabase
    .from('grocery_lists')
    .insert({
      id: masterListId,
      name: 'Master Grocery List',
      user_id: 'anonymous'
    });
  
  if (createError) {
    console.error('Error creating master list:', createError);
    throw new Error('Failed to create master list');
  }
  
  return {
    id: masterListId,
    name: 'Master Grocery List',
    items: [],
    createdAt: new Date().toISOString(),
    isMaster: true
  };
};

/**
 * Create a new custom grocery list
 */
export const createCustomList = async (name: string): Promise<GroceryList> => {
  const listId = uuidv4();
  
  const { error } = await supabase
    .from('grocery_lists')
    .insert({
      id: listId,
      name,
      user_id: 'anonymous'
    });
  
  if (error) {
    console.error('Error creating custom list:', error);
    throw new Error('Failed to create custom list');
  }
  
  return {
    id: listId,
    name,
    items: [],
    createdAt: new Date().toISOString(),
    isMaster: false
  };
};

/**
 * Add ingredients to the master grocery list
 */
export const addToMasterList = async (recipeId: string, recipeTitle: string, ingredients: Ingredient[]): Promise<GroceryList> => {
  // Get or create master list
  const masterList = await getMasterGroceryList();
  
  if (ingredients.length === 0) return masterList;
  
  // Get existing items to check for duplicates
  const existingItems = await getGroceryItemsByListId(masterList.id);
  const existingItemMap = new Map();
  
  existingItems.forEach(item => {
    // Create a key based on normalized name and unit for grouping
    const key = getIngredientKey(item.name, item.unit);
    existingItemMap.set(key, item);
  });
  
  // Process new ingredients
  const itemsToUpdate = [];
  const itemsToInsert = [];
  
  for (const ingredient of ingredients) {
    const key = getIngredientKey(ingredient.name, ingredient.unit);
    
    if (existingItemMap.has(key)) {
      // Update existing item by adding quantities
      const existingItem = existingItemMap.get(key);
      const existingQty = parseFloat(existingItem.quantity || '0') || 0;
      const newQty = parseFloat(ingredient.quantity || '0') || 0;
      const totalQty = existingQty + newQty;
      
      itemsToUpdate.push({
        id: existingItem.id,
        quantity: totalQty.toString()
      });
    } else {
      // Add new item
      itemsToInsert.push({
        id: uuidv4(),
        list_id: masterList.id,
        ingredient_id: ingredient.id || null,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        completed: false,
        recipe_id: recipeId,
        recipe_title: recipeTitle
      });
    }
  }
  
  // Perform updates
  if (itemsToUpdate.length > 0) {
    for (const item of itemsToUpdate) {
      const { error } = await supabase
        .from('grocery_items')
        .update({ quantity: item.quantity })
        .eq('id', item.id);
      
      if (error) {
        console.error('Error updating grocery item:', error);
        throw new Error('Failed to update grocery item');
      }
    }
  }
  
  // Perform inserts
  if (itemsToInsert.length > 0) {
    const { error } = await supabase
      .from('grocery_items')
      .insert(itemsToInsert);
    
    if (error) {
      console.error('Error inserting grocery items:', error);
      throw new Error('Failed to insert grocery items');
    }
  }
  
  // Return updated master list
  return getMasterGroceryList();
};

/**
 * Move an item from one list to another
 */
export const moveItemToList = async (itemId: string, targetListId: string): Promise<void> => {
  const { error } = await supabase
    .from('grocery_items')
    .update({ list_id: targetListId })
    .eq('id', itemId);
  
  if (error) {
    console.error('Error moving grocery item:', error);
    throw new Error('Failed to move grocery item');
  }
};

/**
 * Add ingredients to a grocery list (legacy method, redirects to master list)
 */
export const createGroceryList = async (name: string, ingredients: Ingredient[], recipeId?: string): Promise<GroceryList> => {
  // Use the recipe title as the name if it's from a recipe
  return addToMasterList(recipeId || 'unknown', name, ingredients);
};

/**
 * Update grocery item completion status
 */
export const updateGroceryItemStatus = async (itemId: string, completed: boolean): Promise<void> => {
  const { error } = await supabase
    .from('grocery_items')
    .update({ completed })
    .eq('id', itemId);
  
  if (error) {
    console.error('Error updating grocery item:', error);
    throw new Error('Failed to update grocery item');
  }
};
/**
 * Add ingredients to a grocery list with aggregation
 */
export const addIngredientsToList = async (
  listId: string,
  recipeId: string,
  recipeTitle: string,
  ingredients: Ingredient[]
): Promise<void> => {
  if (ingredients.length === 0) return;
  
  // Get existing items to check for duplicates
  const existingItems = await getGroceryItemsByListId(listId);
  const existingItemMap = new Map();
  
  existingItems.forEach(item => {
    // Create a key based on name and unit for grouping
    const key = getIngredientKey(item.name, item.unit);
    existingItemMap.set(key, item);
  });
  
  // Process new ingredients
  const itemsToUpdate = [];
  const itemsToInsert = [];
  
  for (const ingredient of ingredients) {
    const key = getIngredientKey(ingredient.name, ingredient.unit);
    
    if (existingItemMap.has(key)) {
      // Update existing item by adding quantities
      const existingItem = existingItemMap.get(key);
      const existingQty = parseFloat(existingItem.quantity || '0') || 0;
      const newQty = parseFloat(ingredient.quantity || '0') || 0;
      const totalQty = existingQty + newQty;
      
      itemsToUpdate.push({
        id: existingItem.id,
        quantity: totalQty.toString()
      });
    } else {
      // Add new item
      itemsToInsert.push({
        id: uuidv4(),
        list_id: listId,
        ingredient_id: ingredient.id || null,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        completed: false,
        recipe_id: recipeId,
        recipe_title: recipeTitle
      });
    }
  }
  
  // Perform updates
  if (itemsToUpdate.length > 0) {
    for (const item of itemsToUpdate) {
      const { error } = await supabase
        .from('grocery_items')
        .update({ quantity: item.quantity })
        .eq('id', item.id);
      
      if (error) {
        console.error('Error updating grocery item:', error);
        throw new Error('Failed to update grocery item');
      }
    }
  }
  
  // Perform inserts
  if (itemsToInsert.length > 0) {
    const { error } = await supabase
      .from('grocery_items')
      .insert(itemsToInsert);
    
    if (error) {
      console.error('Error inserting grocery items:', error);
      throw new Error('Failed to insert grocery items');
    }
  }
};
/**
 * Delete a grocery list
 */
export const deleteGroceryList = async (listId: string): Promise<void> => {
  // First delete all items in the list
  const { error: itemsError } = await supabase
    .from('grocery_items')
    .delete()
    .eq('list_id', listId);
  
  if (itemsError) {
    console.error('Error deleting grocery items:', itemsError);
    throw new Error('Failed to delete grocery items');
  }
  
  // Then delete the list itself
  const { error: listError } = await supabase
    .from('grocery_lists')
    .delete()
    .eq('id', listId);
  
  if (listError) {
    console.error('Error deleting grocery list:', listError);
    throw new Error('Failed to delete grocery list');
  }
};
/**
 * Delete a grocery item
 */
export const deleteGroceryItem = async (itemId: string): Promise<void> => {
  const { error } = await supabase
    .from('grocery_items')
    .delete()
    .eq('id', itemId);
  
  if (error) {
    console.error('Error deleting grocery item:', error);
    throw new Error('Failed to delete grocery item');
  }
};
/**
 * Update a grocery list name
 */
export const updateGroceryListName = async (listId: string, name: string): Promise<void> => {
  const { error } = await supabase
    .from('grocery_lists')
    .update({ name })
    .eq('id', listId);
  
  if (error) {
    console.error('Error updating grocery list name:', error);
    throw new Error('Failed to update grocery list name');
  }
};

/**
 * Share grocery list via WhatsApp/SMS
 */
export const shareGroceryList = async (listId: string, phoneNumber?: string): Promise<void> => {
  try {
    // Get the list with its items
    const list = await getGroceryListById(listId);
    
    // Call the backend API to send the message
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/share-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listId,
        listName: list.name,
        items: list.items,
        phoneNumber
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to share grocery list');
    }
  } catch (err) {
    console.error('Error sharing grocery list:', err);
    throw new Error('Failed to share grocery list');
  }
};