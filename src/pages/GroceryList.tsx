import { useState, useEffect, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import '../assets/grocery-animations.css';
import '../assets/list-animations.css';
import './GroceryList.css';
import { getGroceryLists, updateGroceryItemStatus, createCustomList, moveItemToList, deleteGroceryList, deleteGroceryItem, updateGroceryListName, shareMultipleGroceryLists, clearAllItemsFromList } from '../services/grocery/groceryService';
import { GroceryList as GroceryListType } from '../types/recipe';
import { FaSpinner, FaShoppingBasket, FaPlus, FaTrash, FaChevronUp, FaShareAlt, FaCheck } from 'react-icons/fa';
import { FaPen, FaXmark } from "react-icons/fa6";
import ShareListsModal from '../components/ShareListsModal';

// Helper functions for ingredient normalization
const normalizeIngredientName = (name: string): string => {
  let normalized = name.toLowerCase();
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

const normalizeUnit = (unit: string | null): string | null => {
  if (!unit) return null;
  
  const unitMap: Record<string, string> = {
    'g': 'g', 'gm': 'g', 'gram': 'g', 'grams': 'g',
    'kg': 'kg', 'kilo': 'kg', 'kilos': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml', 'millilitre': 'ml', 'millilitres': 'ml',
    'l': 'l', 'liter': 'l', 'liters': 'l', 'litre': 'l', 'litres': 'l',
    'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
    'lb': 'lb', 'lbs': 'lb', 'pound': 'lb', 'pounds': 'lb',
    'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
    'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'cup': 'cup', 'cups': 'cup'
  };
  
  const normalizedUnit = unit.toLowerCase().trim();
  return unitMap[normalizedUnit] || normalizedUnit;
};

const getUniqueItemsCount = (items: any[]): number => {
  return new Set(
    items.map(item => {
      const normalizedName = normalizeIngredientName(item.name);
      const normalizedUnit = normalizeUnit(item.unit);
      return `${normalizedName}|${normalizedUnit || ''}`;
    })
  ).size;
};

const GroceryList = () => {
  const [lists, setLists] = useState<GroceryListType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editedListName, setEditedListName] = useState('');
  const [collapsedLists, setCollapsedLists] = useState<Set<string>>(new Set());
  const [shareSuccess, setShareSuccess] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [clearingAllItems, setClearingAllItems] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<string | null>(null);
  
  const fetchLists = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getGroceryLists();
      
      // Force sort here to ensure master list is first
      const sortedLists = [...data].sort((a, b) => {
        // Use name directly for more reliable sorting
        if (a.name === 'Master Grocery List') return -1;
        if (b.name === 'Master Grocery List') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setLists(sortedLists);
    } catch (err) {
      setError('Failed to fetch grocery lists. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchLists();
  }, []);
  
  const handleToggleItem = async (listId: string, itemId: string, completed: boolean) => {
    try {
      await updateGroceryItemStatus(itemId, !completed);
      
      // Update local state
      setLists(lists.map(list => {
        if (list.id === listId) {
          return {
            ...list,
            items: list.items.map(item => {
              if (item.id === itemId) {
                return { ...item, completed: !completed };
              }
              return item;
            })
          };
        }
        return list;
      }));
    } catch (err) {
      console.error('Failed to update item status:', err);
    }
  };
  
  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    
    setCreatingList(true);
    try {
      await createCustomList(newListName);
      
      // Fetch all lists again to ensure proper sorting
      await fetchLists();
      setNewListName('');
      setShowInput(false); // Hide the input after creating a list
    } catch (err) {
      console.error('Failed to create list:', err);
      setError('Failed to create custom list');
    } finally {
      setCreatingList(false);
    }
  };
  
  const handleMoveItem = async (itemId: string, sourceListId: string, targetListId: string) => {
    try {
      // Skip if trying to move within the same list
      if (sourceListId === targetListId) return;
      
      await moveItemToList(itemId, targetListId);
      
      // Update local state
      const sourceList = lists.find(list => list.id === sourceListId);
      const targetList = lists.find(list => list.id === targetListId);
      
      if (sourceList && targetList) {
        const movedItem = sourceList.items.find(item => item.id === itemId);
        
        if (movedItem) {
          setLists(lists.map(list => {
            if (list.id === sourceListId) {
              return {
                ...list,
                items: list.items.filter(item => item.id !== itemId)
              };
            }
            if (list.id === targetListId) {
              // If there's a matching item, we'll let the aggregation in the component handle it
              return {
                ...list,
                items: [...list.items, {...movedItem, listId: targetListId}]
              };
            }
            return list;
          }));
        }
      }
    } catch (err) {
      console.error('Failed to move item:', err);
      setError('Failed to move item to another list');
    }
  };
  
  const handleDeleteList = async (listId: string) => {
    // Don't allow deleting the master list
    const list = lists.find(l => l.id === listId);
    if (list?.name === 'Master Grocery List') {
      setError('Cannot delete the master grocery list');
      return;
    }
    
    setDeletingListId(listId);
    
    try {
      await deleteGroceryList(listId);
      
      // Update local state
      setLists(lists.filter(list => list.id !== listId));
    } catch (err) {
      console.error('Failed to delete list:', err);
      setError('Failed to delete grocery list');
    } finally {
      setDeletingListId(null);
    }
  };
  
  const handleEditList = (listId: string, currentName: string) => {
    setEditingListId(listId);
    setEditedListName(currentName);
  };
  
  const toggleListCollapse = (listId: string) => {
    setCollapsedLists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(listId)) {
        newSet.delete(listId);
      } else {
        newSet.add(listId);
      }
      return newSet;
    });
  };

  const handleClearAllItems = async (listId: string) => {
    setClearingAllItems(listId);
    
    try {
      await clearAllItemsFromList(listId);
      
      // Update local state to remove all items from the list
      setLists(lists.map(list => {
        if (list.id === listId) {
          return { ...list, items: [] };
        }
        return list;
      }));
      
      setShowClearAllConfirm(null);
    } catch (err) {
      console.error('Failed to clear all items:', err);
      setError('Failed to clear all items from list');
    } finally {
      setClearingAllItems(null);
    }
  };
  
  const handleSaveListName = async (listId: string) => {
    if (!editedListName.trim()) {
      setEditingListId(null);
      return;
    }
    
    try {
      await updateGroceryListName(listId, editedListName);
      
      // Update local state
      setLists(lists.map(list => {
        if (list.id === listId) {
          return { ...list, name: editedListName };
        }
        return list;
      }));
      
      setEditingListId(null);
    } catch (err) {
      console.error('Failed to update list name:', err);
      setError('Failed to update list name');
    }
  };
  
  const handleDeleteItem = async (listId: string, itemId: string) => {
    try {
      await deleteGroceryItem(itemId);
      
      // Update local state
      setLists(lists.map(list => {
        if (list.id === listId) {
          return {
            ...list,
            items: list.items.filter(item => item.id !== itemId)
          };
        }
        return list;
      }));
    } catch (err) {
      console.error('Failed to delete item:', err);
      setError('Failed to delete grocery item');
    }
  };
  
  const handleShareMultipleLists = async (listIds: string[], phoneNumber?: string) => {
    setError(null);
    
    try {
      await shareMultipleGroceryLists(listIds, phoneNumber);
      setShareSuccess(true);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setShareSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Failed to share lists:', err);
      setError('Failed to share grocery lists');
      throw err;
    }
  };
  // Move renderLists definition above all conditional returns
  const renderLists = () => {
    if (lists.length === 0) {
      return (
        <div>
          <h1 className="text-2xl font-bold mb-6">Grocery Lists</h1>
          <div className="bg-gray-50 p-8 rounded-md text-center">
            <FaShoppingBasket className="text-4xl text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">You don't have any grocery lists yet.</p>
            <p className="text-gray-500">
              Create a grocery list from a recipe to get started.
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <DndProvider backend={HTML5Backend}>
        <div>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Grocery Lists</h1>
            
            <div className="flex items-center gap-4">
              <div className="create-list-container">
                <button 
                  onClick={() => setShowInput(true)}
                  className={`btn btn-primary flex items-center create-list-button ${showInput ? 'hidden' : ''}`}
                >
                  <FaPlus />
                </button>
                
                <form onSubmit={handleCreateList} className={`create-list-form ${showInput ? 'visible' : ''}`}>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="New list name"
                    className="input mr-2 w-48"
                    disabled={creatingList}
                    autoFocus={showInput}
                  />
                  <div className="flex space-x-2">
                    {newListName.trim() ? (
                      <button 
                        type="submit" 
                        className="text-primary hover:text-green-600 p-2"
                        disabled={creatingList}
                      >
                        {creatingList ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                      </button>
                    ) : null}
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowInput(false);
                        setNewListName('');
                      }}
                      className="text-gray-500 hover:text-red-500 p-2"
                    >
                      <FaXmark size={18} />
                    </button>
                  </div>
                </form>
              </div>
              
              {/* Share multiple lists button */}
              {lists.length > 0 && (
                <button 
                  onClick={() => setShowShareModal(true)}
                  className="btn btn-secondary flex items-center"
                  title="Share multiple lists"
                >
                  <FaShareAlt />
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {lists.map(list => (
            <div key={list.id} className="bg-white rounded-lg shadow-md overflow-hidden h-full">
              <div 
                className={`${list.name === 'Master Grocery List' ? 'bg-primary' : 'bg-secondary'} text-white p-4 flex justify-between items-start cursor-pointer transition-colors duration-200`} 
                onClick={() => toggleListCollapse(list.id)}
              >
                <div className="flex-grow">
                  {editingListId === list.id ? (
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={editedListName}
                        onChange={(e) => setEditedListName(e.target.value)}
                        className="bg-transparent text-white border border-white/50 px-2 py-1 rounded w-full mr-2 focus:outline-none focus:border-white"
                        autoFocus
                      />
                      <div className="flex mr-2">
                        <button
                          onClick={() => handleSaveListName(list.id)}
                          className="text-white hover:text-green-300 p-2"
                          title="Save list name"
                        >
                          <FaCheck size={14}/>
                        </button>
                        <button
                          onClick={() => setEditingListId(null)}
                          className="text-white hover:text-red-300 p-2"
                          title="Cancel editing"
                        >
                          <FaXmark size={18}/>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <h2 className="text-xl font-semibold flex items-center">
                      {list.name}
                      {(() => {
                        const uniqueCount = getUniqueItemsCount(list.items);
                        
                        if (uniqueCount !== list.items.length) {
                          return (
                            <span className="ml-2 text-sm bg-white/20 px-2 py-0.5 rounded-full">
                              {uniqueCount} unique / {list.items.length} total
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </h2>
                  )}
                </div>
                <div className="flex space-x-2 items-center">
                  {list.name === 'Master Grocery List' && editingListId !== list.id && list.items.length > 0 && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowClearAllConfirm(list.id);
                      }}
                      disabled={clearingAllItems === list.id}
                      className="text-white opacity-80 hover:opacity-100 p-1 transition-opacity"
                      title="Clear all items"
                    >
                      {clearingAllItems === list.id ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                    </button>
                  )}
                  {list.name !== 'Master Grocery List' && editingListId !== list.id && (
                    <>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditList(list.id, list.name);
                        }}
                        className="text-white opacity-80 hover:opacity-100 p-1 transition-opacity"
                        title="Edit list name"
                      >
                        <FaPen />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteList(list.id);
                        }}
                        disabled={deletingListId === list.id}
                        className="text-white opacity-80 hover:opacity-100 p-1 transition-opacity"
                        title="Delete list"
                      >
                        {deletingListId === list.id ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                      </button>
                    </>
                  )}
                  <FaChevronUp className={`collapse-icon ${collapsedLists.has(list.id) ? '' : 'up'}`} />
                </div>
              </div>
              
              <div className={`grocery-list-container ${collapsedLists.has(list.id) ? 'collapsed' : 'expanded'}`}>
                <DroppableList 
                  list={list} 
                  handleToggleItem={handleToggleItem} 
                  handleDeleteItem={handleDeleteItem}
                  handleMoveItem={handleMoveItem}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DndProvider>
  );
  };

  // Now all conditional returns can safely use renderLists
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-primary text-2xl" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-md">
        {error}
      </div>
    );
  }
  
  if (shareSuccess) {
    return (
      <div>
        <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-md flex items-center">
          <FaCheck className="mr-2" />
          Grocery list shared successfully!
        </div>
        {renderLists()}
      </div>
    );
  }

  return (
    <>
      {renderLists()}
      <ShareListsModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        lists={lists}
        onShare={handleShareMultipleLists}
      />
      
      {/* Clear All Items Confirmation Modal */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Clear All Items</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to clear all items from the Master Grocery List? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowClearAllConfirm(null)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleClearAllItems(showClearAllConfirm)}
                disabled={clearingAllItems === showClearAllConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {clearingAllItems === showClearAllConfirm ? (
                  <span className="flex items-center">
                    <FaSpinner className="animate-spin mr-2" />
                    Clearing...
                  </span>
                ) : (
                  'Clear All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GroceryList;
// Draggable grocery item component
interface DraggableItemProps {
  item: any;
  listId: string;
  handleToggleItem: (listId: string, itemId: string, completed: boolean) => void;
  handleDeleteItem: (listId: string, itemId: string) => void;
}

const DraggableItem = ({ item, listId, handleToggleItem, handleDeleteItem }: DraggableItemProps) => {
  const isCompleted = item.completed;
  
  // Set up drag source
  const [{ isDragging }, drag] = useDrag({
    type: 'GROCERY_ITEM',
    item: { id: item.id, sourceListId: listId },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    }),
    canDrag: !!item.id // Only allow dragging if the item has an ID (not aggregated-only items)
  });
  
  return (
    <li
      ref={drag}
      className={`py-3 flex items-center justify-between grocery-item ${isDragging ? 'opacity-50' : ''} ${isCompleted ? 'completed' : ''}`}
      style={{ 
        cursor: item.id ? 'move' : 'default'
      }}
    >
      <div className="flex items-center flex-1">
        <button
          onClick={() => item.id && handleToggleItem(listId, item.id, item.completed)}
          className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 transition-all duration-200 ${isCompleted
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 hover:border-green-300'
          }`}
          disabled={!item.id}
        >
          {isCompleted && <FaCheck className="text-xs" />}
        </button>
        <div className="flex-1">
          <div className="grid grid-cols-2">
            <span
              className={`transition-all duration-300 ${isCompleted ? 'line-through text-gray-400' : ''}`}
            >
              {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
            </span>
            <span className="text-gray-500 pl-4">
              {item.quantity} {item.unit}
            </span>
          </div>
          {item.recipeTitle && (
            <span className="text-xs text-gray-500 block">
              From: {item.recipeTitle.includes(',') ? 'Multiple recipes' : item.recipeTitle}
              {item.recipeTitle.includes(',') && (
                <span className="text-xs text-gray-400 ml-1">(aggregated)</span>
              )}
            </span>
          )}
        </div>
      </div>
      
      <div className="ml-2 flex-shrink-0">
        {item.id && (
          <button 
            onClick={() => handleDeleteItem(listId, item.id!)}
            className="text-gray-400 hover:text-red-500 p-1"
            title="Delete item"
          >
            <FaXmark />
          </button>
        )}
      </div>
    </li>
  );
};
// Droppable list component
interface DroppableListProps {
  list: GroceryListType;
  handleToggleItem: (listId: string, itemId: string, completed: boolean) => void;
  handleDeleteItem: (listId: string, itemId: string) => void;
  handleMoveItem: (itemId: string, sourceListId: string, targetListId: string) => void;
}

const DroppableList = ({ list, handleToggleItem, handleDeleteItem, handleMoveItem }: DroppableListProps) => {
  // Set up drop target
  const [{ isOver }, drop] = useDrop({
    accept: 'GROCERY_ITEM',
    drop: (item: { id: string, sourceListId: string }) => {
      // Only handle drops between different lists
      if (item.sourceListId !== list.id) {
        handleMoveItem(item.id, item.sourceListId, list.id);
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver()
    })
  });
  
  // Always aggregate ingredients with normalized names and units
  const aggregatedItems = useMemo(() => {
    const itemMap = new Map();
    
    // Group items by normalized name and unit
    list.items.forEach(item => {
      const normalizedName = normalizeIngredientName(item.name);
      const normalizedUnit = normalizeUnit(item.unit);
      const key = `${normalizedName}|${normalizedUnit || ''}`;
      
      if (itemMap.has(key)) {
        const existingItem = itemMap.get(key);
        // If any of the grouped items is completed, mark the aggregated item as completed
        const isCompleted = existingItem.completed || item.completed;
        // Sum the quantities if they are numeric
        const existingQty = parseFloat(existingItem.quantity || '0') || 0;
        const newQty = parseFloat(item.quantity || '0') || 0;
        const totalQty = existingQty + newQty;
        
        // Update the existing item
        itemMap.set(key, {
          ...existingItem,
          quantity: totalQty > 0 ? totalQty.toString() : null,
          completed: isCompleted,
          // Combine recipe titles if they're different
          recipeTitle: existingItem.recipeTitle !== item.recipeTitle && item.recipeTitle 
            ? `${existingItem.recipeTitle || ''}, ${item.recipeTitle}`.trim()
            : existingItem.recipeTitle
        });
      } else {
        itemMap.set(key, { ...item });
      }
    });
    
    return Array.from(itemMap.values());
  }, [list.items]);
  
  // Sort items to move completed ones to the bottom
  const sortedItems = [...aggregatedItems].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return 0;
  });
  
  return (
    <div 
      ref={drop} 
      className={`p-4 ${isOver ? 'bg-blue-50' : ''}`}
      style={{ transition: 'background-color 0.2s ease' }}
    >
      <div className="max-h-[640px] overflow-y-auto pr-4">
        <ul className="divide-y divide-gray-200 grocery-list">
          {sortedItems.map((item, index) => (
            <DraggableItem 
              key={item.id || `aggregated-${index}`}
              item={item}
              listId={list.id}
              handleToggleItem={handleToggleItem}
              handleDeleteItem={handleDeleteItem}
            />
          ))}
        </ul>
      </div>
      
      {list.items.length === 0 && (
        <p className="text-gray-500 text-center py-4">
          This list is empty.
        </p>
      )}
    </div>
  );
};
