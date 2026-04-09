import { useState, useEffect, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import '../assets/grocery-animations.css';
import '../assets/list-animations.css';
import './GroceryList.css';
import {
  getGroceryLists,
  updateGroceryItemStatus,
  createCustomList,
  moveItemToList,
  deleteGroceryList,
  deleteGroceryItem,
  updateGroceryListName,
  shareMultipleGroceryLists,
  clearAllItemsFromList,
} from '../services/grocery/groceryService';
import { GroceryList as GroceryListType } from '../types/recipe';
import {
  Check,
  Loader2,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
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
  const prefixesToRemove = [
    'fresh ',
    'dried ',
    'frozen ',
    'chopped ',
    'sliced ',
    'diced ',
    'minced ',
    'whole ',
  ];
  const suffixesToRemove = [
    ' leaves',
    ' bunch',
    ' bunches',
    ' stalk',
    ' stalks',
    ' sprig',
    ' sprigs',
    ' clove',
    ' cloves',
  ];

  prefixesToRemove.forEach((prefix) => {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length);
    }
  });

  suffixesToRemove.forEach((suffix) => {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, normalized.length - suffix.length);
    }
  });

  return normalized.trim();
};

const normalizeUnit = (unit: string | null): string | null => {
  if (!unit) return null;

  const unitMap: Record<string, string> = {
    g: 'g',
    gm: 'g',
    gram: 'g',
    grams: 'g',
    kg: 'kg',
    kilo: 'kg',
    kilos: 'kg',
    kilogram: 'kg',
    kilograms: 'kg',
    ml: 'ml',
    milliliter: 'ml',
    milliliters: 'ml',
    millilitre: 'ml',
    millilitres: 'ml',
    l: 'l',
    liter: 'l',
    liters: 'l',
    litre: 'l',
    litres: 'l',
    oz: 'oz',
    ounce: 'oz',
    ounces: 'oz',
    lb: 'lb',
    lbs: 'lb',
    pound: 'lb',
    pounds: 'lb',
    tbsp: 'tbsp',
    tablespoon: 'tbsp',
    tablespoons: 'tbsp',
    tsp: 'tsp',
    teaspoon: 'tsp',
    teaspoons: 'tsp',
    cup: 'cup',
    cups: 'cup',
  };

  const normalizedUnit = unit.toLowerCase().trim();
  return unitMap[normalizedUnit] || normalizedUnit;
};

const getUniqueItemsCount = (items: any[]): number => {
  return new Set(
    items.map((item) => {
      const normalizedName = normalizeIngredientName(item.name);
      const normalizedUnit = normalizeUnit(item.unit);
      return `${normalizedName}|${normalizedUnit || ''}`;
    })
  ).size;
};

type BulkMode = 'none' | 'delete' | 'share';

const GroceryList = () => {
  const { addNotification } = useNotification();
  const [lists, setLists] = useState<GroceryListType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editedListName, setEditedListName] = useState('');
  const [shareSuccess, setShareSuccess] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareModalInitialIds, setShareModalInitialIds] = useState<string[]>([]);
  const [clearingAllItems, setClearingAllItems] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<string | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState<BulkMode>('none');
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchLists = async () => {
    setLoading(true);

    try {
      const data = await getGroceryLists();

      const sortedLists = [...data].sort((a, b) => {
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

  useEffect(() => {
    if (lists.length === 0) {
      setActiveListId(null);
      return;
    }
    setActiveListId((prev) => {
      if (prev && lists.some((l) => l.id === prev)) return prev;
      return lists[0].id;
    });
  }, [lists]);

  const activeList = lists.find((l) => l.id === activeListId) ?? null;

  const resetBulk = () => {
    setBulkMode('none');
    setBulkSelectedIds([]);
  };

  /** Collapsing the sidebar while in share/delete selection exits that mode (same as cancel). */
  useEffect(() => {
    if (!sidebarCollapsed || bulkMode === 'none') return;
    setBulkMode('none');
    setBulkSelectedIds([]);
  }, [sidebarCollapsed, bulkMode]);

  const toggleBulkId = (id: string) => {
    setBulkSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleItem = async (listId: string, itemId: string, completed: boolean) => {
    try {
      await updateGroceryItemStatus(itemId, !completed);

      setLists(
        lists.map((list) => {
          if (list.id === listId) {
            return {
              ...list,
              items: list.items.map((item) => {
                if (item.id === itemId) {
                  return { ...item, completed: !completed };
                }
                return item;
              }),
            };
          }
          return list;
        })
      );
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

      await fetchLists();
      setNewListName('');
      setShowInput(false);
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
      if (sourceListId === targetListId) return;

      await moveItemToList(itemId, targetListId);

      const sourceList = lists.find((list) => list.id === sourceListId);
      const targetList = lists.find((list) => list.id === targetListId);

      if (sourceList && targetList) {
        const movedItem = sourceList.items.find((item) => item.id === itemId);

        if (movedItem) {
          setLists(
            lists.map((list) => {
              if (list.id === sourceListId) {
                return {
                  ...list,
                  items: list.items.filter((item) => item.id !== itemId),
                };
              }
              if (list.id === targetListId) {
                return {
                  ...list,
                  items: [...list.items, { ...movedItem, listId: targetListId }],
                };
              }
              return list;
            })
          );
        }
      }
    } catch (err) {
      console.error('Failed to move item:', err);
      addNotification('error', 'Failed to move item to another list');
    }
  };

  const handleConfirmBulkDelete = async () => {
    const ids = bulkSelectedIds.filter((id) => {
      const l = lists.find((x) => x.id === id);
      return l && l.name !== 'Master Grocery List';
    });
    if (ids.length === 0) {
      addNotification('warning', 'Select at least one list you can delete.');
      return;
    }

    setBulkDeleting(true);
    try {
      for (const id of ids) {
        await deleteGroceryList(id);
      }
      setLists((prev) => prev.filter((l) => !ids.includes(l.id)));
      addNotification('success', ids.length === 1 ? 'List deleted.' : 'Lists deleted.');
      resetBulk();
    } catch (err) {
      console.error('Bulk delete failed:', err);
      addNotification('error', 'Failed to delete one or more lists.');
      await fetchLists();
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleConfirmBulkShare = () => {
    if (bulkSelectedIds.length === 0) {
      addNotification('warning', 'Select at least one list to share.');
      return;
    }
    setShareModalInitialIds([...bulkSelectedIds]);
    setShowShareModal(true);
    resetBulk();
  };

  const handleEditList = (listId: string, currentName: string) => {
    setEditingListId(listId);
    setEditedListName(currentName);
  };

  const handleClearAllItems = async (listId: string) => {
    setClearingAllItems(listId);

    try {
      await clearAllItemsFromList(listId);

      setLists(
        lists.map((list) => {
          if (list.id === listId) {
            return { ...list, items: [] };
          }
          return list;
        })
      );

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

      setLists(
        lists.map((list) => {
          if (list.id === listId) {
            return { ...list, name: editedListName };
          }
          return list;
        })
      );

      setEditingListId(null);
    } catch (err) {
      console.error('Failed to update list name:', err);
      addNotification('error', 'Failed to update list name');
    }
  };

  const handleDeleteItem = async (listId: string, itemId: string) => {
    try {
      await deleteGroceryItem(itemId);

      setLists(
        lists.map((list) => {
          if (list.id === listId) {
            return {
              ...list,
              items: list.items.filter((item) => item.id !== itemId),
            };
          }
          return list;
        })
      );
    } catch (err) {
      console.error('Failed to delete item:', err);
      addNotification('error', 'Failed to delete grocery item');
    }
  };

  const handleShareMultipleLists = async (listIds: string[], phoneNumber?: string) => {
    try {
      await shareMultipleGroceryLists(listIds, phoneNumber);
      setShareSuccess(true);

      setTimeout(() => {
        setShareSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Failed to share lists:', err);
      addNotification('error', 'Failed to share grocery lists');
      throw err;
    }
  };

  const openShareFromSidebar = () => {
    if (lists.length === 0) return;
    setBulkMode('share');
    setBulkSelectedIds([]);
    setShowInput(false);
  };

  const openDeleteFromSidebar = () => {
    if (lists.length === 0) return;
    setBulkMode('delete');
    setBulkSelectedIds([]);
    setShowInput(false);
  };

  /** Full-bleed within `main` padding; flex row aligns sidebar top with list (no magic fixed top). */
  const layoutShellClass =
    'relative flex h-full min-h-0 w-[calc(100%+2rem)] max-w-none -mx-4 items-stretch gap-4 overflow-hidden pl-4 pr-1 sm:pl-5';

  const renderEmpty = () => (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <div className="flex min-h-0 flex-1 items-center">
        <div className="w-full rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-10 text-center text-sm leading-relaxed">
          <ShoppingBasket className="mx-auto mb-4 size-12 text-muted-foreground" />
          <p className="mb-2 font-medium text-foreground">You don&apos;t have any grocery lists yet.</p>
          <p className="text-muted-foreground">Create a grocery list from a recipe to get started.</p>
        </div>
      </div>
    </div>
  );

  const renderSidebar = () => {
    const inBulk = bulkMode !== 'none';
    const showTitles = lists.length > 0;

    const sidebarIcon = (active: boolean, variant: 'share' | 'delete') =>
      cn(
        'icon-hit shrink-0',
        variant === 'delete'
          ? active
            ? 'text-destructive'
            : 'text-muted-foreground hover:text-destructive'
          : active
            ? 'text-primary'
            : 'text-muted-foreground hover:text-primary'
      );

    const deletableSelected =
      bulkSelectedIds.filter((id) => {
        const l = lists.find((x) => x.id === id);
        return l && l.name !== 'Master Grocery List';
      }).length > 0;

    return (
      <aside
        className={cn(
          'z-30 flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90 ring-1 ring-black/[0.04] shadow-[4px_6px_18px_-6px_rgba(0,0,0,0.07)] backdrop-blur-xl backdrop-saturate-150 transition-[width] duration-300 ease-out dark:ring-white/[0.06] dark:shadow-[4px_8px_22px_-4px_rgba(0,0,0,0.35)]',
          sidebarCollapsed ? 'w-14' : 'w-72 max-w-[min(18rem,calc(100vw-2rem))]'
        )}
        aria-label="Grocery lists"
      >
        {/* Separator always directly under the toggle row (collapsed or expanded). */}
        <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
          <div
            className={cn(
              'flex',
              sidebarCollapsed ? 'justify-center' : 'flex-row items-center justify-between gap-2'
            )}
          >
            <TooltipTrigger label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                className="icon-hit shrink-0 text-muted-foreground hover:text-foreground"
                aria-expanded={!sidebarCollapsed}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="size-5" strokeWidth={1.75} />
                ) : (
                  <PanelLeftClose className="size-5" strokeWidth={1.75} />
                )}
              </button>
            </TooltipTrigger>
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-end gap-1.5">
                <TooltipTrigger label="New list">
                  <button
                    type="button"
                    onClick={() => {
                      resetBulk();
                      setShowInput(true);
                    }}
                    disabled={inBulk}
                    className={cn(
                      'icon-hit shrink-0 text-muted-foreground hover:text-primary',
                      'disabled:pointer-events-none disabled:opacity-40'
                    )}
                    aria-label="New list"
                  >
                    <Plus className="size-5" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipTrigger label="Delete lists">
                  <button
                    type="button"
                    onClick={() => {
                      if (bulkMode === 'delete') resetBulk();
                      else openDeleteFromSidebar();
                    }}
                    disabled={lists.length === 0 || bulkMode === 'share'}
                    className={cn(
                      sidebarIcon(bulkMode === 'delete', 'delete'),
                      (lists.length === 0 || bulkMode === 'share') && 'pointer-events-none opacity-40'
                    )}
                    aria-label="Delete lists"
                  >
                    <Trash2 className="size-5" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
              </div>
            ) : null}
          </div>
        </div>

        {sidebarCollapsed ? (
          <div className="flex shrink-0 flex-col items-center gap-2 px-3 py-2.5">
            <TooltipTrigger label="New list">
              <button
                type="button"
                onClick={() => {
                  resetBulk();
                  setShowInput(true);
                  setSidebarCollapsed(false);
                }}
                className="icon-hit shrink-0 text-muted-foreground hover:text-primary"
                aria-label="New list"
              >
                <Plus className="size-5" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipTrigger label="Delete lists">
              <button
                type="button"
                onClick={() => {
                  if (bulkMode === 'delete') resetBulk();
                  else openDeleteFromSidebar();
                  setSidebarCollapsed(false);
                }}
                disabled={lists.length === 0 || bulkMode === 'share'}
                className={cn(
                  sidebarIcon(bulkMode === 'delete', 'delete'),
                  (lists.length === 0 || bulkMode === 'share') && 'pointer-events-none opacity-40'
                )}
                aria-label="Delete lists"
              >
                <Trash2 className="size-5" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipTrigger label="Share lists">
              <button
                type="button"
                onClick={() => {
                  if (bulkMode === 'share') resetBulk();
                  else openShareFromSidebar();
                  setSidebarCollapsed(false);
                }}
                disabled={lists.length === 0 || bulkMode === 'delete'}
                className={cn(
                  sidebarIcon(bulkMode === 'share', 'share'),
                  (lists.length === 0 || bulkMode === 'delete') && 'pointer-events-none opacity-40'
                )}
                aria-label="Share lists"
              >
                <Share2 className="size-5" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
          </div>
        ) : null}

        {!sidebarCollapsed && showInput && !inBulk ? (
          <div className="shrink-0 space-y-2 border-b border-border/60 px-3 py-2.5">
            <form onSubmit={handleCreateList} className="flex flex-col gap-2 pt-0.5">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name"
                className="input w-full rounded-lg border-border py-2 text-sm"
                disabled={creatingList}
                autoFocus
              />
              <div className="flex justify-center gap-2 pt-0.5">
                <TooltipTrigger label="Create list">
                  <button
                    type="submit"
                    disabled={creatingList || !newListName.trim()}
                    className="icon-hit text-primary disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Create list"
                  >
                    {creatingList ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <Check className="size-5" strokeWidth={1.75} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipTrigger label="Cancel">
                  <button
                    type="button"
                    disabled={creatingList}
                    className="icon-hit text-muted-foreground disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Cancel"
                    onClick={() => {
                      setShowInput(false);
                      setNewListName('');
                    }}
                  >
                    <X className="size-5" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
              </div>
            </form>
          </div>
        ) : null}

        {!sidebarCollapsed ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
            {showTitles ? (
              <ul className="space-y-1">
                {lists.map((list) => {
                  const isActive = list.id === activeListId;
                  const isMaster = list.name === 'Master Grocery List';
                  const showCheckbox = bulkMode === 'delete' || bulkMode === 'share';
                  const checked = bulkSelectedIds.includes(list.id);

                  return (
                    <li key={list.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (bulkMode === 'delete') {
                            if (isMaster) return;
                            toggleBulkId(list.id);
                            return;
                          }
                          if (bulkMode === 'share') {
                            toggleBulkId(list.id);
                            return;
                          }
                          setActiveListId(list.id);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm transition-all',
                          isActive && bulkMode === 'none'
                            ? 'border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary'
                            : 'border-transparent bg-muted/25 text-foreground hover:border-border/80 hover:bg-muted/50',
                          bulkMode !== 'none' && checked && 'border-primary/40 bg-primary/15 text-foreground'
                        )}
                      >
                        {showCheckbox ? (
                          <span
                            className={cn(
                              'flex size-4 shrink-0 items-center justify-center rounded-full border',
                              checked
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input bg-background',
                              bulkMode === 'delete' && isMaster && 'opacity-40'
                            )}
                            aria-hidden
                          >
                            {checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate font-medium leading-tight">
                          {list.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">No lists yet.</p>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1" aria-hidden />
        )}

        {/* Collapsed: share lives in header. Expanded: share here when idle; bulk actions always here. */}
        {(inBulk || !sidebarCollapsed) && (
          <div className="shrink-0 px-3 py-2.5">
            {inBulk ? (
              <div className="flex items-center justify-center gap-3">
                <TooltipTrigger label="Cancel">
                  <button
                    type="button"
                    onClick={resetBulk}
                    disabled={bulkDeleting}
                    className="icon-hit text-muted-foreground disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Cancel"
                  >
                    <X className="size-5" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                {bulkMode === 'delete' ? (
                  <TooltipTrigger label="Confirm delete">
                    <button
                      type="button"
                      onClick={handleConfirmBulkDelete}
                      disabled={bulkDeleting || !deletableSelected}
                      className="icon-hit icon-hit--destructive text-destructive disabled:pointer-events-none disabled:opacity-40"
                      aria-label="Confirm delete"
                    >
                      {bulkDeleting ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <Check className="size-5" strokeWidth={1.75} />
                      )}
                    </button>
                  </TooltipTrigger>
                ) : (
                  <TooltipTrigger label="Confirm share">
                    <button
                      type="button"
                      onClick={handleConfirmBulkShare}
                      disabled={bulkSelectedIds.length === 0}
                      className="icon-hit text-primary disabled:pointer-events-none disabled:opacity-40"
                      aria-label="Confirm share"
                    >
                      <Check className="size-5" strokeWidth={1.75} />
                    </button>
                  </TooltipTrigger>
                )}
              </div>
            ) : (
              <div className="flex justify-center">
                <TooltipTrigger label="Share lists">
                  <button
                    type="button"
                    onClick={() => {
                      openShareFromSidebar();
                      setSidebarCollapsed(false);
                    }}
                    disabled={lists.length === 0}
                    className={cn(
                      sidebarIcon(false, 'share'),
                      lists.length === 0 && 'pointer-events-none opacity-40'
                    )}
                    aria-label="Share lists"
                  >
                    <Share2 className="size-5" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
              </div>
            )}
          </div>
        )}
      </aside>
    );
  };

  const renderMainListCard = () => {
    if (!activeList) return null;
    const list = activeList;

    return (
      <div className="flex min-h-0 h-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[3px_5px_16px_-6px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] dark:shadow-[3px_6px_18px_-4px_rgba(0,0,0,0.28)] dark:ring-white/[0.06]">
        <div
          className={cn(
            list.name === 'Master Grocery List'
              ? 'bg-primary text-primary-foreground'
              : 'border-b-2 border-primary/40 bg-muted text-foreground',
            'flex shrink-0 items-center justify-between px-4 py-5 transition-colors duration-200'
          )}
        >
          <div className="min-w-0 flex-grow">
            {editingListId === list.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedListName}
                  onChange={(e) => setEditedListName(e.target.value)}
                  className={cn(
                    'min-w-0 flex-1 rounded border px-2 py-1 text-sm focus:outline-none',
                    list.name === 'Master Grocery List'
                      ? 'border-white/50 bg-transparent text-primary-foreground placeholder:text-primary-foreground/70 focus:border-white'
                      : 'border-border bg-background text-foreground'
                  )}
                  autoFocus
                />
                <TooltipTrigger label="Save list name">
                  <button
                    type="button"
                    onClick={() => handleSaveListName(list.id)}
                    className={cn(
                      'icon-hit shrink-0',
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
                    onClick={() => setEditingListId(null)}
                    className={cn(
                      'icon-hit shrink-0',
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
            ) : (
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-tight">
                <span className="min-w-0">{list.name}</span>
                {(() => {
                  const uniqueCount = getUniqueItemsCount(list.items);

                  if (uniqueCount !== list.items.length) {
                    return (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-sm',
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
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {list.name === 'Master Grocery List' && editingListId !== list.id && list.items.length > 0 && (
              <TooltipTrigger label="Clear list">
                <button
                  type="button"
                  onClick={() => setShowClearAllConfirm(list.id)}
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
              <TooltipTrigger label="Edit list name">
                <button
                  type="button"
                  onClick={() => handleEditList(list.id, list.name)}
                  className={cn(
                    'icon-hit',
                    list.name === 'Master Grocery List' ? 'text-primary-foreground' : 'text-foreground'
                  )}
                  aria-label="Edit list name"
                >
                  <Pencil className="size-4" />
                </button>
              </TooltipTrigger>
            )}
          </div>
        </div>

        <div className="grocery-list-container expanded flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DroppableList
            list={list}
            handleToggleItem={handleToggleItem}
            handleDeleteItem={handleDeleteItem}
            handleMoveItem={handleMoveItem}
          />
        </div>
      </div>
    );
  };

  const renderLists = () => {
    const shell = <>{renderSidebar()}</>;

    if (lists.length === 0) {
      return (
        <div className={layoutShellClass}>
          {shell}
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col pr-4">
            {renderEmpty()}
          </div>
        </div>
      );
    }

    return (
      <DndProvider backend={HTML5Backend}>
        <div className={layoutShellClass}>
          {shell}
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col pr-4">
            {shareSuccess ? (
              <div className="mb-3 shrink-0 flex items-center rounded-xl border border-primary/25 bg-primary/10 p-3 text-sm font-medium text-foreground">
                <Check className="mr-2 size-4 shrink-0" strokeWidth={1.75} />
                Grocery list shared successfully!
              </div>
            ) : null}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">{renderMainListCard()}</div>
          </div>
        </div>
      </DndProvider>
    );
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden text-foreground">
      {renderLists()}
      <ShareListsModal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setShareModalInitialIds([]);
        }}
        lists={lists}
        onShare={handleShareMultipleLists}
        initialSelectedListIds={shareModalInitialIds}
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

interface DraggableItemProps {
  item: any;
  listId: string;
  handleToggleItem: (listId: string, itemId: string, completed: boolean) => void;
  handleDeleteItem: (listId: string, itemId: string) => void;
}

const DraggableItem = ({ item, listId, handleToggleItem, handleDeleteItem }: DraggableItemProps) => {
  const isCompleted = item.completed;

  const [{ isDragging }, drag] = useDrag({
    type: 'GROCERY_ITEM',
    item: { id: item.id, sourceListId: listId },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    canDrag: !!item.id,
  });

  return (
    <li
      ref={drag}
      className={`grocery-item flex items-center justify-between py-3 ${isDragging ? 'opacity-50' : ''} ${isCompleted ? 'completed' : ''}`}
      style={{
        cursor: item.id ? 'move' : 'default',
      }}
    >
      <div className="flex flex-1 items-center">
        <button
          type="button"
          onClick={() => item.id && handleToggleItem(listId, item.id, item.completed)}
          className={`mr-3 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
            isCompleted
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

interface DroppableListProps {
  list: GroceryListType;
  handleToggleItem: (listId: string, itemId: string, completed: boolean) => void;
  handleDeleteItem: (listId: string, itemId: string) => void;
  handleMoveItem: (itemId: string, sourceListId: string, targetListId: string) => void;
}

const DroppableList = ({ list, handleToggleItem, handleDeleteItem, handleMoveItem }: DroppableListProps) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'GROCERY_ITEM',
    drop: (item: { id: string; sourceListId: string }) => {
      if (item.sourceListId !== list.id) {
        handleMoveItem(item.id, item.sourceListId, list.id);
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  const aggregatedItems = useMemo(() => {
    const itemMap = new Map();

    list.items.forEach((item) => {
      const normalizedName = normalizeIngredientName(item.name);
      const normalizedUnit = normalizeUnit(item.unit);
      const key = `${normalizedName}|${normalizedUnit || ''}`;

      if (itemMap.has(key)) {
        const existingItem = itemMap.get(key);
        const isCompleted = existingItem.completed || item.completed;
        const existingQty = parseFloat(existingItem.quantity || '0') || 0;
        const newQty = parseFloat(item.quantity || '0') || 0;
        const totalQty = existingQty + newQty;

        itemMap.set(key, {
          ...existingItem,
          quantity: totalQty > 0 ? totalQty.toString() : null,
          completed: isCompleted,
          recipeTitle:
            existingItem.recipeTitle !== item.recipeTitle && item.recipeTitle
              ? `${existingItem.recipeTitle || ''}, ${item.recipeTitle}`.trim()
              : existingItem.recipeTitle,
        });
      } else {
        itemMap.set(key, { ...item });
      }
    });

    return Array.from(itemMap.values());
  }, [list.items]);

  const sortedItems = [...aggregatedItems].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return 0;
  });

  return (
    <div
      ref={drop}
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col p-4', isOver && 'bg-primary/5')}
      style={{ transition: 'background-color 0.2s ease' }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto pr-4">
        <ul className="grocery-list divide-y divide-border">
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
        <p className="py-4 text-center text-sm text-muted-foreground">This list is empty.</p>
      )}
    </div>
  );
};
