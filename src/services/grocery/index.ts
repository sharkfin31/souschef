import { 
  getGroceryLists, 
  getGroceryListById, 
  updateGroceryItemStatus, 
  createGroceryList,
  getMasterGroceryList,
  createCustomList,
  addToMasterList,
  moveItemToList,
  addIngredientsToList,
  deleteGroceryList,
  deleteGroceryItem,
  updateGroceryListName,
  shareGroceryList
} from './groceryService';

export const groceryService = {
  getGroceryLists,
  getGroceryListById,
  updateGroceryItemStatus,
  createGroceryList,
  getMasterGroceryList,
  createCustomList,
  addToMasterList,
  moveItemToList,
  addIngredientsToList,
  deleteGroceryList,
  deleteGroceryItem,
  updateGroceryListName,
  shareGroceryList
};

export default groceryService;