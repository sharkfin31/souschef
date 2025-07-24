// Re-export from modular structure
import { groceryService } from './grocery';

export const getGroceryLists = groceryService.getGroceryLists;
export const getGroceryListById = groceryService.getGroceryListById;
export const updateGroceryItemStatus = groceryService.updateGroceryItemStatus;
export const createGroceryList = groceryService.createGroceryList;
export const getMasterGroceryList = groceryService.getMasterGroceryList;
export const createCustomList = groceryService.createCustomList;
export const addToMasterList = groceryService.addToMasterList;
export const moveItemToList = groceryService.moveItemToList;
export const addIngredientsToList = groceryService.addIngredientsToList;
export const deleteGroceryList = groceryService.deleteGroceryList;
export const deleteGroceryItem = groceryService.deleteGroceryItem;
export const updateGroceryListName = groceryService.updateGroceryListName;
export const shareGroceryList = groceryService.shareGroceryList;
