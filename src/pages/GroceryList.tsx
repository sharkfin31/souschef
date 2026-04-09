import { useState, useEffect, useMemo, useCallback } from 'react';
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
} from '../services/grocery/groceryService';
import { GroceryItem, GroceryList as GroceryListType } from '../types/recipe';
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  Filter,
  ListX,
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

const GROCERY_TABLE_CLASS =
  'w-full min-w-0 table-fixed border-collapse text-sm text-foreground';

const collectRecipeFilterOptions = (
  items: GroceryItem[]
): { key: string; label: string }[] => {
  const seen = new Map<string, string>();
  for (const item of items) {
    const raw = item.recipeTitle?.trim();
    if (!raw) {
      seen.set('__none__', 'No recipe');
      continue;
    }
    const parts = raw.includes(',')
      ? raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [raw];
    for (const part of parts) {
      if (!seen.has(part)) seen.set(part, part);
    }
  }
  return Array.from(seen.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
};

const itemMatchesRecipeFilter = (
  item: { recipeTitle?: string | null },
  selected: Set<string>
): boolean => {
  if (selected.size === 0) return true;
  const raw = item.recipeTitle?.trim();
  if (!raw) return selected.has('__none__');
  const parts = raw.includes(',')
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [raw];
  return parts.some((p) => selected.has(p));
};

const formatRecipeCell = (recipeTitle: string | null | undefined): string => {
  if (!recipeTitle?.trim()) return '—';
  if (recipeTitle.includes(',')) return 'Multiple recipes';
  return recipeTitle;
};

const recipeCellTitle = (recipeTitle: string | null | undefined): string | undefined => {
  if (!recipeTitle?.trim()) return undefined;
  return recipeTitle.includes(',') ? recipeTitle.split(',').map((s) => s.trim()).join(' · ') : recipeTitle;
};

/** Sort key for recipe column: empty last, first recipe title when multiple */
const recipeSortKey = (item: { recipeTitle?: string | null }): string => {
  const raw = item.recipeTitle?.trim();
  if (!raw) return '\uffff';
  if (raw.includes(',')) {
    const first = raw.split(',')[0]?.trim() || '';
    return first.toLocaleLowerCase();
  }
  return raw.toLocaleLowerCase();
};

/** Column sort: item cycles default → A–Z → Z–A; recipe toggles default ↔ A–Z; only one “mode” at a time */
type GroceryListSortState = 'default' | 'item_az' | 'item_za' | 'recipe_az';

function cycleItemColumnSort(prev: GroceryListSortState): GroceryListSortState {
  if (prev === 'item_az') return 'item_za';
  if (prev === 'item_za') return 'default';
  return 'item_az';
}

function cycleRecipeColumnSort(prev: GroceryListSortState): GroceryListSortState {
  if (prev === 'recipe_az') return 'default';
  return 'recipe_az';
}

function groceryItemSortTooltip(state: GroceryListSortState): string {
  if (state === 'item_az') return 'Switch to Z–A';
  if (state === 'item_za') return 'Clear item sort';
  return 'Sort by item (A–Z)';
}

function groceryRecipeSortTooltip(state: GroceryListSortState): string {
  return state === 'recipe_az' ? 'Clear recipe sort' : 'Sort by recipe (A–Z)';
}

type BulkMode = 'none' | 'delete';

type ItemSelectMode = 'none' | 'move' | 'delete';

interface SidebarListRowProps {
  list: GroceryListType;
  isActive: boolean;
  isMaster: boolean;
  showCheckbox: boolean;
  checked: boolean;
  bulkMode: BulkMode;
  onClick: () => void;
}

function SidebarListRow({
  list,
  isActive,
  isMaster,
  showCheckbox,
  checked,
  bulkMode,
  onClick,
}: SidebarListRowProps) {
  return (
    <li className="rounded-xl">
      <button
        type="button"
        onClick={onClick}
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
        <span className="min-w-0 flex-1 truncate font-medium leading-tight">{list.name}</span>
      </button>
    </li>
  );
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState<BulkMode>('none');
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  /** Multi-item move: pick destination list (opened after bulk or single selection). */
  const [moveItemsDialog, setMoveItemsDialog] = useState<{
    itemIds: string[];
    sourceListId: string;
    /** Capitalized ingredient name when exactly one item */
    primaryLabel?: string;
  } | null>(null);
  /** Bulk select rows on the active list for move or delete. */
  const [itemSelectMode, setItemSelectMode] = useState<ItemSelectMode>('none');
  const [itemSelectIds, setItemSelectIds] = useState<string[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(() => new Set());
  const [grocerySortState, setGrocerySortState] = useState<GroceryListSortState>('default');
  const [recipeFilterModalOpen, setRecipeFilterModalOpen] = useState(false);
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState<{
    listId: string;
    ids: string[];
  } | null>(null);
  const [bulkDeletingItems, setBulkDeletingItems] = useState(false);

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

  const recipeFilterOptions = useMemo(
    () => collectRecipeFilterOptions(activeList?.items ?? []),
    [activeList?.items]
  );

  const toggleRecipeFilterKey = useCallback((key: string) => {
    setSelectedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearRecipeFilters = useCallback(() => setSelectedRecipes(new Set()), []);

  const resetItemSelect = useCallback(() => {
    setItemSelectMode('none');
    setItemSelectIds([]);
  }, []);

  useEffect(() => {
    resetItemSelect();
  }, [activeListId, resetItemSelect]);

  useEffect(() => {
    setSelectedRecipes(new Set());
  }, [activeListId]);

  const toggleItemSelectId = useCallback((id: string) => {
    setItemSelectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAllInViewToggle = useCallback((selectableIds: string[]) => {
    if (selectableIds.length === 0) return;
    setItemSelectIds((prev) => {
      const allSelected = selectableIds.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((id) => !selectableIds.includes(id));
      return [...new Set([...prev, ...selectableIds])];
    });
  }, []);

  const resetBulk = () => {
    setBulkMode('none');
    setBulkSelectedIds([]);
  };

  /** Collapsing the sidebar while in delete selection exits that mode (same as cancel). */
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

  const openShareModalDirect = () => {
    if (lists.length === 0) return;
    resetBulk();
    setShareModalInitialIds(lists.map((l) => l.id));
    setShowShareModal(true);
    setShowInput(false);
  };

  const handleEditList = (listId: string, currentName: string) => {
    setEditingListId(listId);
    setEditedListName(currentName);
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

  const handleOpenMoveItemsDialog = () => {
    if (itemSelectIds.length === 0) {
      addNotification('warning', 'Select at least one item.');
      return;
    }
    if (!activeList) return;
    let primaryLabel: string | undefined;
    if (itemSelectIds.length === 1) {
      const it = activeList.items.find((i) => i.id === itemSelectIds[0]);
      if (it?.name) {
        primaryLabel = it.name.charAt(0).toUpperCase() + it.name.slice(1);
      }
    }
    setMoveItemsDialog({
      itemIds: [...itemSelectIds],
      sourceListId: activeList.id,
      primaryLabel,
    });
    resetItemSelect();
  };

  const handleRequestBulkDeleteDialog = () => {
    if (itemSelectIds.length === 0) {
      addNotification('warning', 'Select at least one item.');
      return;
    }
    if (!activeList) return;
    setBulkDeleteDialog({ listId: activeList.id, ids: [...itemSelectIds] });
    resetItemSelect();
  };

  const handleExecuteBulkDelete = async () => {
    if (!bulkDeleteDialog) return;
    const { listId, ids } = bulkDeleteDialog;
    setBulkDeletingItems(true);
    try {
      await Promise.all(ids.map((id) => deleteGroceryItem(id)));
      setLists((prev) =>
        prev.map((list) =>
          list.id !== listId
            ? list
            : { ...list, items: list.items.filter((i) => i.id && !ids.includes(i.id)) }
        )
      );
      addNotification(
        'success',
        ids.length === 1 ? 'Item removed from list.' : `${ids.length} items removed from list.`
      );
      setBulkDeleteDialog(null);
    } catch (err) {
      console.error('Failed to bulk delete items:', err);
      addNotification('error', 'Failed to delete one or more items.');
      await fetchLists();
      setBulkDeleteDialog(null);
    } finally {
      setBulkDeletingItems(false);
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
          'z-30 flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[4px_6px_18px_-6px_rgba(0,0,0,0.06)] transition-[width] duration-300 ease-out dark:shadow-[4px_8px_22px_-4px_rgba(0,0,0,0.25)]',
          sidebarCollapsed ? 'w-14' : 'w-72 max-w-[min(18rem,calc(100vw-2rem))]'
        )}
        aria-label="Grocery lists"
      >
        {/* Separator always directly under the toggle row (collapsed or expanded). */}
        <div className="shrink-0 border-b border-border/60 px-3 py-4">
          <div
            className={cn(
              'flex',
              sidebarCollapsed ? 'justify-center' : 'flex-row items-center justify-between gap-2'
            )}
          >
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="icon-hit shrink-0 text-muted-foreground hover:text-foreground"
              aria-expanded={!sidebarCollapsed}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="size-5" strokeWidth={1.75} />
              ) : (
                <PanelLeftClose className="size-5" strokeWidth={1.75} />
              )}
            </button>
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
                    disabled={lists.length === 0}
                    className={cn(
                      sidebarIcon(bulkMode === 'delete', 'delete'),
                      lists.length === 0 && 'pointer-events-none opacity-40'
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
          <div className="flex shrink-0 flex-col items-center gap-2 px-3 py-4">
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
                disabled={lists.length === 0}
                className={cn(
                  sidebarIcon(bulkMode === 'delete', 'delete'),
                  lists.length === 0 && 'pointer-events-none opacity-40'
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
                  openShareModalDirect();
                  setSidebarCollapsed(false);
                }}
                disabled={lists.length === 0 || bulkMode === 'delete'}
                className={cn(
                  sidebarIcon(false, 'share'),
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
                  const showCheckbox = bulkMode === 'delete';
                  const checked = bulkSelectedIds.includes(list.id);

                  return (
                    <SidebarListRow
                      key={list.id}
                      list={list}
                      isActive={isActive}
                      isMaster={isMaster}
                      showCheckbox={showCheckbox}
                      checked={checked}
                      bulkMode={bulkMode}
                      onClick={() => {
                        if (bulkMode === 'delete') {
                          if (isMaster) return;
                          toggleBulkId(list.id);
                          return;
                        }
                        setActiveListId(list.id);
                      }}
                    />
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
                <TooltipTrigger label="Confirm delete">
                  <button
                    type="button"
                    onClick={handleConfirmBulkDelete}
                    disabled={bulkDeleting || !deletableSelected}
                    className="icon-hit text-primary disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Confirm delete"
                  >
                    {bulkDeleting ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <Trash2 className="size-5" strokeWidth={1.75} />
                    )}
                  </button>
                </TooltipTrigger>
              </div>
            ) : (
              <div className="flex justify-center">
                <TooltipTrigger label="Share lists">
                  <button
                    type="button"
                    onClick={() => {
                      openShareModalDirect();
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
    const isMaster = list.name === 'Master Grocery List';
    const selecting = itemSelectMode !== 'none';
    const canMoveToAnotherList = lists.filter((l) => l.id !== list.id).length > 0;

    const toneIcon = cn(
      'icon-hit shrink-0 rounded-full text-primary-foreground transition-colors',
      'hover:bg-primary-foreground/15 hover:text-primary hover:ring-1 hover:ring-primary-foreground/35'
    );

    return (
      <div className="flex min-h-0 h-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[3px_5px_16px_-6px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] dark:shadow-[3px_6px_18px_-4px_rgba(0,0,0,0.28)] dark:ring-white/[0.06]">
        <div className="flex shrink-0 items-center gap-3 border-b-2 border-primary/30 bg-primary px-4 py-4 text-primary-foreground transition-colors duration-200">
          <div className="min-w-0 flex-1">
            {editingListId === list.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={editedListName}
                  onChange={(e) => setEditedListName(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-white/50 bg-transparent px-2 py-1 text-sm text-primary-foreground placeholder:text-primary-foreground/70 focus:border-white focus:outline-none"
                  autoFocus
                />
                <TooltipTrigger label="Save list name">
                  <button
                    type="button"
                    onClick={() => handleSaveListName(list.id)}
                    className={toneIcon}
                    aria-label="Save list name"
                  >
                    <Check className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipTrigger label="Cancel editing">
                  <button
                    type="button"
                    onClick={() => setEditingListId(null)}
                    className={toneIcon}
                    aria-label="Cancel editing"
                  >
                    <X className="size-4" />
                  </button>
                </TooltipTrigger>
              </div>
            ) : (
              <h2 className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-semibold leading-tight">
                <span className="min-w-0 truncate">{list.name}</span>
                {(() => {
                  const uniqueCount = getUniqueItemsCount(list.items);

                  if (uniqueCount !== list.items.length) {
                    return (
                      <span className="shrink-0 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-sm">
                        {uniqueCount} unique / {list.items.length} total
                      </span>
                    );
                  }
                  return null;
                })()}
              </h2>
            )}
          </div>
          {editingListId !== list.id && list.items.length > 0 ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {selecting ? (
                <>
                  <button
                    type="button"
                    onClick={resetItemSelect}
                    className={toneIcon}
                    aria-label="Cancel selection"
                  >
                    <X className="size-5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (itemSelectMode === 'move') handleOpenMoveItemsDialog();
                      else if (itemSelectMode === 'delete') handleRequestBulkDeleteDialog();
                    }}
                    disabled={itemSelectIds.length === 0}
                    className={toneIcon}
                    aria-label={
                      itemSelectMode === 'move' ? 'Choose destination list' : 'Review delete'
                    }
                  >
                    {itemSelectMode === 'delete' ? (
                      <Trash2 className="size-5" strokeWidth={1.75} />
                    ) : (
                      <ArrowRight className="size-5" strokeWidth={1.75} />
                    )}
                  </button>
                </>
              ) : (
                <>
                  {recipeFilterOptions.length > 0 ? (
                    <TooltipTrigger label="Filter by recipe">
                      <button
                        type="button"
                        onClick={() => setRecipeFilterModalOpen(true)}
                        className={cn(toneIcon, 'relative')}
                        aria-label="Filter by recipe"
                      >
                        <Filter className="size-5" strokeWidth={1.75} />
                        {selectedRecipes.size > 0 ? (
                          <span className="absolute -right-0.5 -top-0.5 flex size-2 rounded-full bg-primary-foreground" />
                        ) : null}
                      </button>
                    </TooltipTrigger>
                  ) : null}
                  {canMoveToAnotherList ? (
                    <TooltipTrigger label="Move items">
                      <button
                        type="button"
                        onClick={() => {
                          setItemSelectMode('move');
                          setItemSelectIds([]);
                        }}
                        className={toneIcon}
                        aria-label="Select items to move"
                      >
                        <ArrowRightLeft className="size-5" strokeWidth={1.75} />
                      </button>
                    </TooltipTrigger>
                  ) : null}
                  <TooltipTrigger label="Delete items">
                    <button
                      type="button"
                      onClick={() => {
                        setItemSelectMode('delete');
                        setItemSelectIds([]);
                      }}
                      className={toneIcon}
                      aria-label="Select items to delete"
                    >
                      <ListX className="size-5" strokeWidth={1.75} />
                    </button>
                  </TooltipTrigger>
                  {!isMaster ? (
                    <TooltipTrigger label="Edit list name">
                      <button
                        type="button"
                        onClick={() => handleEditList(list.id, list.name)}
                        className={toneIcon}
                        aria-label="Edit list name"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </TooltipTrigger>
                  ) : null}
                </>
              )}
            </div>
          ) : !isMaster && editingListId !== list.id ? (
            <div className="flex shrink-0 items-center gap-1">
              <TooltipTrigger label="Edit list name">
                <button
                  type="button"
                  onClick={() => handleEditList(list.id, list.name)}
                  className={toneIcon}
                  aria-label="Edit list name"
                >
                  <Pencil className="size-4" />
                </button>
              </TooltipTrigger>
            </div>
          ) : null}
        </div>

        <div className="grocery-list-container expanded flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DroppableList
            list={list}
            handleToggleItem={handleToggleItem}
            selectedRecipes={selectedRecipes}
            sortState={grocerySortState}
            onCycleItemSort={() => setGrocerySortState((prev) => cycleItemColumnSort(prev))}
            onCycleRecipeSort={() => setGrocerySortState((prev) => cycleRecipeColumnSort(prev))}
            itemSelectMode={itemSelectMode}
            itemSelectIds={itemSelectIds}
            onSelectAllInViewToggle={handleSelectAllInViewToggle}
            onClearRecipeFilters={clearRecipeFilters}
            onToggleItemSelectId={toggleItemSelectId}
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
        open={recipeFilterModalOpen}
        onOpenChange={setRecipeFilterModalOpen}
      >
        <DialogContent className="gap-3 sm:max-w-xl" showCloseButton>
          <DialogHeader className="min-h-11 shrink-0 space-y-0 pr-12">
            <DialogTitle className="flex min-h-11 items-center text-left text-base leading-tight">
              Filter by recipe
            </DialogTitle>
          </DialogHeader>
          <div
            className="flex max-h-[min(65vh,28rem)] flex-wrap gap-2 overflow-y-auto py-0.5"
            role="group"
            aria-label="Recipe filters"
          >
            <button
              type="button"
              onClick={() => clearRecipeFilters()}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                selectedRecipes.size === 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/80 bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted/60'
              )}
            >
              All
            </button>
            {recipeFilterOptions.map((opt) => {
              const on = selectedRecipes.has(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleRecipeFilterKey(opt.key)}
                  className={cn(
                    'max-w-full truncate rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    on
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/80 bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted/60'
                  )}
                  title={opt.label}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!moveItemsDialog}
        onOpenChange={(open) => {
          if (!open) setMoveItemsDialog(null);
        }}
      >
        <DialogContent className="gap-3 sm:max-w-md" showCloseButton>
          <DialogHeader className="min-h-11 shrink-0 space-y-0 pr-12">
            <DialogTitle className="flex min-h-11 items-center text-left text-base leading-tight">
              {moveItemsDialog
                ? moveItemsDialog.primaryLabel
                  ? `Move ${moveItemsDialog.primaryLabel} to`
                  : `Move ${moveItemsDialog.itemIds.length} items to`
                : 'Move items'}
            </DialogTitle>
          </DialogHeader>
          <ul className="max-h-[min(60vh,22rem)] space-y-1 overflow-y-auto py-0.5">
            {moveItemsDialog
              ? lists
                  .filter((l) => l.id !== moveItemsDialog.sourceListId)
                  .map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        className="flex w-full rounded-xl border border-transparent bg-muted/30 px-3 py-2.5 text-left text-sm font-medium transition-colors hover:border-border hover:bg-muted/50"
                        onClick={async () => {
                          const snap = moveItemsDialog;
                          if (!snap) return;
                          const { itemIds } = snap;
                          setMoveItemsDialog(null);
                          try {
                            for (const id of itemIds) {
                              await moveItemToList(id, l.id);
                            }
                            await fetchLists();
                            addNotification(
                              'success',
                              itemIds.length === 1
                                ? `Moved to ${l.name}`
                                : `${itemIds.length} items moved to ${l.name}`
                            );
                          } catch (err) {
                            console.error(err);
                            addNotification('error', 'Failed to move items.');
                            await fetchLists();
                          }
                        }}
                      >
                        {l.name}
                      </button>
                    </li>
                  ))
              : null}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!bulkDeleteDialog}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteDialog(null);
        }}
      >
        <DialogContent className="gap-4 sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-left text-base leading-tight">
              Delete selected items?
            </DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed">
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-row justify-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => setBulkDeleteDialog(null)}
              disabled={bulkDeletingItems}
              className="icon-hit text-muted-foreground disabled:pointer-events-none disabled:opacity-40"
              aria-label="Cancel"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => void handleExecuteBulkDelete()}
              disabled={bulkDeletingItems}
              className="icon-hit icon-hit--destructive text-destructive disabled:pointer-events-none disabled:opacity-40"
              aria-label="Delete selected items"
            >
              {bulkDeletingItems ? (
                <Loader2 className="size-5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Trash2 className="size-5" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroceryList;

interface GroceryItemTableRowProps {
  item: any;
  listId: string;
  itemSelectMode: ItemSelectMode;
  bulkSelected: boolean;
  handleToggleItem: (listId: string, itemId: string, completed: boolean) => void;
  onToggleItemSelectId: (itemId: string) => void;
}

const GroceryItemTableRow = ({
  item,
  listId,
  itemSelectMode,
  bulkSelected,
  handleToggleItem,
  onToggleItemSelectId,
}: GroceryItemTableRowProps) => {
  const isCompleted = item.completed;
  const selecting = itemSelectMode !== 'none';

  const recipeDisplay = formatRecipeCell(item.recipeTitle);
  const recipeTooltip = recipeCellTitle(item.recipeTitle);

  return (
    <tr
      className={cn(
        'grocery-item transition-colors',
        isCompleted && 'completed',
        selecting && bulkSelected && 'bg-primary/5'
      )}
    >
      <td
        className={cn(
          'border-b border-border/80 border-r border-border/80 align-middle',
          'w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] px-2 py-2 text-center sm:px-2.5'
        )}
      >
        {selecting ? (
          <button
            type="button"
            onClick={() => item.id && onToggleItemSelectId(item.id)}
            disabled={!item.id}
            className={cn(
              'mx-auto flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
              bulkSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:border-primary/50'
            )}
            aria-label={bulkSelected ? 'Deselect item' : 'Select item'}
            aria-pressed={bulkSelected}
          >
            {bulkSelected ? <Check className="size-2.5" strokeWidth={3} /> : null}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => item.id && handleToggleItem(listId, item.id, item.completed)}
            className={cn(
              'mx-auto flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
              isCompleted
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary/50'
            )}
            disabled={!item.id}
            aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {isCompleted && <Check className="size-3" />}
          </button>
        )}
      </td>
      <td
        className="max-w-0 border-b border-border/80 border-r border-border/80 px-3 py-2 align-middle text-sm"
        title={item.name}
      >
        <span
          className={cn(
            'block min-w-0 truncate leading-tight transition-colors duration-150',
            isCompleted && !selecting && 'text-muted-foreground line-through'
          )}
        >
          {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
        </span>
      </td>
      <td className="whitespace-nowrap border-b border-border/80 border-r border-border/80 px-3 py-2 align-middle text-sm tabular-nums text-muted-foreground">
        {[item.quantity, item.unit].filter(Boolean).join(' ') || '—'}
      </td>
      <td
        className="max-w-0 border-b border-border/80 px-3 py-2 align-middle text-sm text-muted-foreground"
        title={recipeTooltip}
      >
        <span className="block min-w-0 truncate">{recipeDisplay}</span>
      </td>
    </tr>
  );
};

interface DroppableListProps {
  list: GroceryListType;
  handleToggleItem: (listId: string, itemId: string, completed: boolean) => void;
  selectedRecipes: Set<string>;
  sortState: GroceryListSortState;
  onCycleItemSort: () => void;
  onCycleRecipeSort: () => void;
  itemSelectMode: ItemSelectMode;
  itemSelectIds: string[];
  onSelectAllInViewToggle: (selectableIds: string[]) => void;
  onClearRecipeFilters: () => void;
  onToggleItemSelectId: (id: string) => void;
}

const DroppableList = ({
  list,
  handleToggleItem,
  selectedRecipes,
  sortState,
  onCycleItemSort,
  onCycleRecipeSort,
  itemSelectMode,
  itemSelectIds,
  onSelectAllInViewToggle,
  onClearRecipeFilters,
  onToggleItemSelectId,
}: DroppableListProps) => {
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

  const recipeFiltered = useMemo(
    () => aggregatedItems.filter((item) => itemMatchesRecipeFilter(item, selectedRecipes)),
    [aggregatedItems, selectedRecipes]
  );

  const displayedItems = useMemo(() => {
    const incompleteFirst = (a: { completed?: boolean }, b: { completed?: boolean }) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      return 0;
    };
    const byName = (a: { name?: string }, b: { name?: string }) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    const byRecipe = (a: { recipeTitle?: string | null }, b: { recipeTitle?: string | null }) =>
      recipeSortKey(a).localeCompare(recipeSortKey(b), undefined, { sensitivity: 'base' });

    const base = [...recipeFiltered];
    if (sortState === 'default') {
      return base.sort(incompleteFirst);
    }
    if (sortState === 'item_az') {
      return base.sort((a, b) => {
        const c = incompleteFirst(a, b);
        if (c !== 0) return c;
        return byName(a, b);
      });
    }
    if (sortState === 'item_za') {
      return base.sort((a, b) => {
        const c = incompleteFirst(a, b);
        if (c !== 0) return c;
        return byName(b, a);
      });
    }
    return base.sort((a, b) => {
      const c = incompleteFirst(a, b);
      if (c !== 0) return c;
      return byRecipe(a, b);
    });
  }, [recipeFiltered, sortState]);

  const selecting = itemSelectMode !== 'none';

  const selectableFilteredIds = useMemo(
    () => displayedItems.map((i) => i.id).filter(Boolean) as string[],
    [displayedItems]
  );

  const allFilteredSelected =
    selectableFilteredIds.length > 0 &&
    selectableFilteredIds.every((id) => itemSelectIds.includes(id));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
      <div className="relative isolate min-h-0 min-w-0 flex-1 overflow-y-auto pr-4">
        {list.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">This list is empty.</p>
        ) : (
          <>
            {displayedItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No items match these recipe filters.{' '}
                <button
                  type="button"
                  onClick={onClearRecipeFilters}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Show all
                </button>
              </p>
            ) : (
              <div className="grocery-list overflow-hidden rounded-lg border border-border/80 bg-card">
                <table
                  className={cn(
                    GROCERY_TABLE_CLASS,
                    '[&_tbody_tr:last-child_td]:border-b-0'
                  )}
                >
                  <colgroup>
                    <col className="w-[3.25rem]" />
                    <col />
                    <col className="w-[10rem]" />
                    <col className="w-[32%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-20 bg-card">
                    <tr>
                      <th
                        scope="col"
                        className="border-b-2 border-border border-r border-border/80 px-2 py-2.5 text-center align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-2.5"
                      >
                        {selecting ? (
                          <button
                            type="button"
                            onClick={() => onSelectAllInViewToggle(selectableFilteredIds)}
                            disabled={selectableFilteredIds.length === 0}
                            className={cn(
                              'mx-auto flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
                              allFilteredSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input bg-background hover:border-primary/50'
                            )}
                            aria-label={
                              allFilteredSelected
                                ? 'Deselect all visible items'
                                : 'Select all visible items'
                            }
                            aria-pressed={allFilteredSelected}
                          >
                            {allFilteredSelected ? (
                              <Check className="size-2.5" strokeWidth={3} />
                            ) : null}
                          </button>
                        ) : (
                          <span className="inline-block w-5" aria-hidden />
                        )}
                      </th>
                      <th
                        scope="col"
                        className={cn(
                          'border-b-2 border-border border-r border-border/80 px-2 py-2 text-left align-middle text-xs font-semibold uppercase tracking-wide',
                          sortState === 'item_az' || sortState === 'item_za'
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        <div className="flex min-w-0 items-center justify-between gap-1">
                          <span className="min-w-0 truncate">Item</span>
                          <button
                            type="button"
                            onClick={onCycleItemSort}
                            className={cn(
                              'inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150',
                              sortState === 'item_az' || sortState === 'item_za'
                                ? 'bg-primary/15 text-primary ring-1 ring-primary/35'
                                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                            )}
                            aria-pressed={
                              sortState === 'item_az' || sortState === 'item_za'
                            }
                            aria-label={groceryItemSortTooltip(sortState)}
                          >
                            <ArrowRightLeft
                              className={cn(
                                'size-4 rotate-90',
                                sortState === 'item_za' && 'scale-y-[-1]'
                              )}
                              strokeWidth={2}
                            />
                          </button>
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="border-b-2 border-border border-r border-border/80 px-3 py-2.5 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Qty
                      </th>
                      <th
                        scope="col"
                        className={cn(
                          'border-b-2 border-border px-2 py-2 text-left align-middle text-xs font-semibold uppercase tracking-wide',
                          sortState === 'recipe_az' ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        <div className="flex min-w-0 items-center justify-between gap-1">
                          <span className="min-w-0 truncate">Recipe</span>
                          <button
                            type="button"
                            onClick={onCycleRecipeSort}
                            className={cn(
                              'inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150',
                              sortState === 'recipe_az'
                                ? 'bg-primary/15 text-primary ring-1 ring-primary/35'
                                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                            )}
                            aria-pressed={sortState === 'recipe_az'}
                            aria-label={groceryRecipeSortTooltip(sortState)}
                          >
                            <ArrowRightLeft className="size-4 rotate-90" strokeWidth={2} />
                          </button>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedItems.map((item, index) => (
                      <GroceryItemTableRow
                        key={item.id || `aggregated-${index}`}
                        item={item}
                        listId={list.id}
                        itemSelectMode={itemSelectMode}
                        bulkSelected={item.id ? itemSelectIds.includes(item.id) : false}
                        handleToggleItem={handleToggleItem}
                        onToggleItemSelectId={onToggleItemSelectId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
