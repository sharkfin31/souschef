import { useState, useEffect, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import '../assets/grocery-animations.css';
import '../assets/list-animations.css';
import './GroceryList.css';
import { getGroceryLists, updateGroceryItemStatus, createCustomList, moveItemToList, deleteGroceryList, deleteGroceryItem, updateGroceryListName, shareMultipleGroceryLists, clearAllItemsFromList } from '../services/grocery/groceryService';
import { GroceryList as GroceryListType } from '../types/recipe';
import {
  Check,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Share2,
  ShoppingBasket,
  Trash2,
  X,
} from 'lucide-react';
import ShareListsModal from '../components/ShareListsModal';
import { useNotification } from '../context/NotificationContext';
import { cn } from '@/lib/utils';
import { TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const { addNotification } = useNotification();
  const [lists, setLists] = useState<GroceryListType[]>([]);
  const [loading, setLoading] = useState(true);
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
      addNotification('error', 'Failed to fetch grocery lists. Please try again later.');
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
      addNotification('success', 'Grocery list created successfully!');
    } catch (err) {
      console.error('Failed to create list:', err);
      addNotification('error', 'Failed to create custom list');
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
      addNotification('error', 'Failed to move item to another list');
    }
  };
  
  const handleDeleteList = async (listId: string) => {
    // Don't allow deleting the master list
    const list = lists.find(l => l.id === listId);
    if (list?.name === 'Master Grocery List') {
      addNotification('warning', 'Cannot delete the master grocery list');
      return;
    }
    
    setDeletingListId(listId);
    
    try {
      await deleteGroceryList(listId);
      
      // Update local state
      setLists(lists.filter(list => list.id !== listId));
      addNotification('success', 'Grocery list deleted successfully!');
    } catch (err) {
      console.error('Failed to delete list:', err);
      addNotification('error', 'Failed to delete grocery list');
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
      addNotification('error', 'Failed to clear all items from list');
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
      addNotification('error', 'Failed to update list name');
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
      addNotification('error', 'Failed to delete grocery item');
    }
  };
  
  const handleShareMultipleLists = async (listIds: string[], phoneNumber?: string) => {
    // Reset any previous errors and update UI optimistically
    
    try {
      await shareMultipleGroceryLists(listIds, phoneNumber);
      setShareSuccess(true);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setShareSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Failed to share lists:', err);
      addNotification('error', 'Failed to share grocery lists');
      throw err;
    }
  };
  // Move renderLists definition above all conditional returns
  const renderLists = () => {
    if (lists.length === 0) {
      return (
        <div className="text-foreground">
          <h1 className="mb-6 flex min-h-12 items-center text-2xl font-bold leading-tight tracking-tight">
            Grocery Lists
          </h1>
          <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-10 text-center text-sm leading-relaxed">
            <ShoppingBasket className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="mb-2 font-medium text-foreground">You don&apos;t have any grocery lists yet.</p>
            <p className="text-muted-foreground">
              Create a grocery list from a recipe to get started.
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <DndProvider backend={HTML5Backend}>
        <div className="text-foreground">
          <div className="mb-6 flex min-h-12 items-center justify-between gap-4">
            <h1 className="text-2xl font-bold leading-tight tracking-tight">Grocery Lists</h1>

            <div className="flex items-center gap-2">
              <div className="create-list-container">
                <TooltipTrigger label="Add" className="relative h-10 w-10 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowInput(true)}
                    className={cn(
                      'create-list-button icon-hit text-muted-foreground hover:text-primary shadow-sm',
                      'focus-visible:outline-none focus-visible:ring-0',
                      showInput && 'hidden'
                    )}
                    aria-label="New grocery list"
                  >
                    <Plus className="size-5" />
                  </button>
                </TooltipTrigger>

                <form
                  onSubmit={handleCreateList}
                  className={cn('create-list-form flex items-center gap-2', showInput && 'visible')}
                >
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="New list name"
                    className="input mr-0 w-48 rounded-lg border-border text-sm"
                    disabled={creatingList}
                    autoFocus={showInput}
                  />
                  <div className="flex items-center gap-1">
                    {newListName.trim() ? (
                      <TooltipTrigger label="Create list" className="inline-flex items-center">
                        <button
                          type="submit"
                          className="icon-hit text-primary"
                          disabled={creatingList}
                          aria-label="Create list"
                        >
                          {creatingList ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
                        </button>
                      </TooltipTrigger>
                    ) : null}
                    <TooltipTrigger label="Cancel" className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setShowInput(false);
                          setNewListName('');
                        }}
                        className="icon-hit text-muted-foreground"
                        aria-label="Cancel"
                      >
                        <X className="size-5" />
                      </button>
                    </TooltipTrigger>
                  </div>
                </form>
              </div>

              {lists.length > 0 && (
                <TooltipTrigger label="Share" className="inline-flex items-center self-center">
                  <button
                    type="button"
                    onClick={() => setShowShareModal(true)}
                    className="icon-hit text-muted-foreground hover:text-primary"
                    aria-label="Share grocery lists"
                  >
                    <Share2 className="size-5" />
                  </button>
                </TooltipTrigger>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {lists.map(list => (
            <div key={list.id} className="h-full overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div 
                className={`${
                  list.name === 'Master Grocery List'
                    ? 'bg-primary text-primary-foreground'
                    : 'border-b-2 border-primary/40 bg-muted text-foreground'
                } flex cursor-pointer items-center justify-between px-4 py-5 transition-colors duration-200`} 
                onClick={() => toggleListCollapse(list.id)}
              >
                <div className="flex-grow">
                  {editingListId === list.id ? (
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={editedListName}
                        onChange={(e) => setEditedListName(e.target.value)}
                        className={cn(
                          'mr-2 w-full rounded border px-2 py-1 text-sm focus:outline-none',
                          list.name === 'Master Grocery List'
                            ? 'border-white/50 bg-transparent text-primary-foreground placeholder:text-primary-foreground/70 focus:border-white'
                            : 'border-border bg-background text-foreground'
                        )}
                        autoFocus
                      />
                      <div className="mr-2 flex items-center gap-0.5">
                        <TooltipTrigger label="Save list name">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveListName(list.id);
                            }}
                            className={cn(
                              'icon-hit',
                              list.name === 'Master Grocery List'
                                ? 'text-primary-foreground'
                                : 'text-foreground hover:text-primary'
                            )}
                            aria-label="Save list name"
                          >
                            <Check className="size-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipTrigger label="Cancel editing">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingListId(null);
                            }}
                            className={cn(
                              'icon-hit',
                              list.name === 'Master Grocery List'
                                ? 'text-primary-foreground'
                                : 'text-muted-foreground hover:text-destructive'
                            )}
                            aria-label="Cancel editing"
                          >
                            <X className="size-4" />
                          </button>
                        </TooltipTrigger>
                      </div>
                    </div>
                  ) : (
                    <h2 className="flex items-center text-lg font-semibold leading-tight">
                      {list.name}
                      {(() => {
                        const uniqueCount = getUniqueItemsCount(list.items);
                        
                        if (uniqueCount !== list.items.length) {
                          return (
                            <span
                              className={cn(
                                'ml-2 rounded-full px-2 py-0.5 text-sm',
                                list.name === 'Master Grocery List'
                                  ? 'bg-primary-foreground/20'
                                  : 'bg-foreground/10 text-muted-foreground'
                              )}
                            >
                              {uniqueCount} unique / {list.items.length} total
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </h2>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {list.name === 'Master Grocery List' && editingListId !== list.id && list.items.length > 0 && (
                    <TooltipTrigger label="Clear list">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowClearAllConfirm(list.id);
                        }}
                        disabled={clearingAllItems === list.id}
                        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-primary-foreground transition-colors duration-150 hover:bg-white hover:text-red-600 focus-visible:outline-none focus-visible:ring-0 disabled:opacity-50"
                        aria-label="Clear all items"
                      >
                        {clearingAllItems === list.id ? (
                          <Loader2 className="size-4 animate-spin text-primary-foreground" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </button>
                    </TooltipTrigger>
                  )}
                  {list.name !== 'Master Grocery List' && editingListId !== list.id && (
                    <>
                      <TooltipTrigger label="Edit list name">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditList(list.id, list.name);
                          }}
                          className="icon-hit text-foreground"
                          aria-label="Edit list name"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipTrigger label="Delete list">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteList(list.id);
                          }}
                          disabled={deletingListId === list.id}
                          className="icon-hit icon-hit--destructive text-destructive"
                          aria-label="Delete list"
                        >
                          {deletingListId === list.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </button>
                      </TooltipTrigger>
                    </>
                  )}
                  <span
                    className={cn(
                      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      list.name === 'Master Grocery List' ? 'bg-primary-foreground/15' : 'bg-foreground/5'
                    )}
                    aria-hidden
                  >
                    <ChevronUp
                      className={cn(
                        'collapse-icon size-4',
                        list.name === 'Master Grocery List' ? 'text-primary-foreground' : 'text-muted-foreground',
                        collapsedLists.has(list.id) ? '' : 'up'
                      )}
                    />
                  </span>
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
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (shareSuccess) {
    return (
      <div className="text-foreground">
        <div className="mb-6 flex items-center rounded-lg border border-primary/25 bg-primary/10 p-4 text-sm font-medium text-foreground">
          <Check className="mr-2 size-4 shrink-0" />
          Grocery list shared successfully!
        </div>
        {renderLists()}
      </div>
    );
  }

  return (
    <div className="text-foreground">
      {renderLists()}
      <ShareListsModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        lists={lists}
        onShare={handleShareMultipleLists}
      />
      
      <Dialog
        open={!!showClearAllConfirm}
        onOpenChange={(open) => {
          if (!open) setShowClearAllConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader className="pr-10">
            <DialogTitle>Clear all items</DialogTitle>
            <DialogDescription>
              Remove every item from the Master Grocery List? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <TooltipTrigger label="Cancel">
              <button
                type="button"
                className="icon-hit text-muted-foreground"
                onClick={() => setShowClearAllConfirm(null)}
                aria-label="Cancel"
              >
                <X className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipTrigger label="Clear all items">
              <button
                type="button"
                className="icon-hit icon-hit--destructive text-destructive"
                onClick={() => showClearAllConfirm && handleClearAllItems(showClearAllConfirm)}
                disabled={clearingAllItems === showClearAllConfirm}
                aria-label="Clear all items"
              >
                {clearingAllItems === showClearAllConfirm ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Trash2 className="size-5" />
                )}
              </button>
            </TooltipTrigger>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
      <div className="flex flex-1 items-center">
        <button
          type="button"
          onClick={() => item.id && handleToggleItem(listId, item.id, item.completed)}
          className={`mr-3 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${isCompleted
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border hover:border-primary/50'
          }`}
          disabled={!item.id}
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          {isCompleted && <Check className="size-3" />}
        </button>
        <div className="flex-1">
          <div className="grid grid-cols-2">
            <span
              className={cn(
                'text-sm transition-all duration-300',
                isCompleted && 'text-muted-foreground line-through'
              )}
            >
              {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
            </span>
            <span className="pl-4 text-sm tabular-nums text-muted-foreground">
              {item.quantity} {item.unit}
            </span>
          </div>
          {item.recipeTitle && (
            <span className="block text-xs text-muted-foreground">
              From: {item.recipeTitle.includes(',') ? 'Multiple recipes' : item.recipeTitle}
              {item.recipeTitle.includes(',') && (
                <span className="ml-1 text-xs text-muted-foreground/80">(aggregated)</span>
              )}
            </span>
          )}
        </div>
      </div>
      
      <div className="ml-2 shrink-0">
        {item.id && (
          <button
            type="button"
            onClick={() => handleDeleteItem(listId, item.id!)}
            className="icon-hit text-muted-foreground hover:text-destructive"
            aria-label="Delete item"
          >
            <X className="size-4" />
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
      className={cn('p-4', isOver && 'bg-primary/5')}
      style={{ transition: 'background-color 0.2s ease' }}
    >
      <div className="max-h-[400px] overflow-y-auto pr-4">
        <ul className="divide-y divide-border grocery-list">
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
        <p className="py-4 text-center text-sm text-muted-foreground">
          This list is empty.
        </p>
      )}
    </div>
  );
};
