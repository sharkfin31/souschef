import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Tags,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { getRecipes } from '../services/recipe/recipeService';
import { useAuth } from '../context/AuthContext';
import { Recipe } from '../types/recipe';
import RecipeCard from '../components/RecipeCard';
import RecipeImport, { type ImportMethod } from '../components/RecipeImport';
import { ImportRecipeFab } from '../components/ImportRecipeFab';
import { useNotification } from '../context/NotificationContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildPaginationItems } from '@/lib/pagination';
import { buildTagEntriesFromRecipes, type TagEntry } from '@/lib/tagUtils';
import { TooltipTrigger } from '@/components/ui/tooltip';

const CUISINE_KEYS = new Set([
  'italian',
  'mexican',
  'chinese',
  'indian',
  'japanese',
  'thai',
  'mediterranean',
  'french',
  'greek',
  'spanish',
  'korean',
  'vietnamese',
  'american',
  'middle eastern',
  'caribbean',
  'african',
]);

const DIETARY_KEYS = new Set([
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'keto',
  'low-carb',
  'paleo',
  'pescatarian',
  'nut-free',
  'egg-free',
]);

const MEAL_KEYS = new Set([
  'breakfast',
  'lunch',
  'dinner',
  'dessert',
  'snack',
  'appetizer',
  'side dish',
  'soup',
  'salad',
  'drink',
  'baking',
]);

const ALL_GROUPED_TAG_KEYS = new Set([...CUISINE_KEYS, ...DIETARY_KEYS, ...MEAL_KEYS]);

const Home = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importInitialMethod, setImportInitialMethod] = useState<ImportMethod | null>(null);
  const [importFabOpen, setImportFabOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedTagKeys, setSelectedTagKeys] = useState<string[]>([]);
  const [tagEntries, setTagEntries] = useState<TagEntry[]>([]);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'cookTime'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const PAGE_SIZE = 6;
  const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRecipes = filteredRecipes.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );
  
  const fetchRecipes = async () => {
    setLoading(true);
    
    try {
      const data = await getRecipes();
      setRecipes(data);
      setFilteredRecipes(data);
      
      setTagEntries(buildTagEntriesFromRecipes(data));
    } catch (err) {
      addNotification('error', 'Failed to fetch recipes. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRecipeImported = () => {
    fetchRecipes();
  };
  
  // Enhanced filtering and sorting logic
  useEffect(() => {
    let filtered = [...recipes];
    
    // Text search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(recipe => 
        recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (recipe.description && recipe.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Tag filter (match any casing on recipe tags)
    if (selectedTagKeys.length > 0) {
      filtered = filtered.filter((recipe) =>
        selectedTagKeys.every((key) =>
          recipe.tags?.some((t) => t.trim().toLowerCase() === key)
        )
      );
    }
    
    // Sort recipes
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'cookTime':
          comparison = (a.cookTime || 0) - (b.cookTime || 0);
          break;
        case 'date':
        default:
          comparison = new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    setFilteredRecipes(filtered);
  }, [searchQuery, selectedTagKeys, sortBy, sortOrder, recipes]);
  
  useEffect(() => {
    fetchRecipes();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedTagKeys, sortBy, sortOrder, recipes.length]);
  
  // Toggle tag selection
  const toggleTag = (key: string) => {
    setSelectedTagKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedTagKeys([]);
    setSearchQuery('');
  };

  const tagFilterPillClass = (key: string) =>
    cn(
      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
      selectedTagKeys.includes(key)
        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
        : 'border-border/60 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
    );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div
      className={cn(
        importFabOpen && 'min-h-[50vh]'
      )}
    >
      <RecipeImport
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) setImportInitialMethod(null);
        }}
        initialMethod={importInitialMethod}
        onRecipeImported={handleRecipeImported}
      />

      <ImportRecipeFab
        visible={!!user}
        open={importFabOpen}
        onOpenChange={setImportFabOpen}
        onSelectMethod={(method) => {
          setImportInitialMethod(method);
          setImportOpen(true);
        }}
      />

      <Dialog open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,800px)] min-h-0 max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          showCloseButton
        >
          {selectedTagKeys.length > 0 ? (
            <TooltipTrigger
              label="Clear Tags"
              className="absolute right-12 top-3 z-20 flex h-11 w-11 items-center justify-center"
            >
              <button
                type="button"
                onClick={() => setSelectedTagKeys([])}
                className="icon-hit icon-hit--destructive text-destructive"
                aria-label="Clear all tag filters"
              >
                <Trash2 className="size-4" />
              </button>
            </TooltipTrigger>
          ) : null}
          <DialogHeader
            className={cn(
              'shrink-0 space-y-1 border-b border-border px-8 py-6',
              selectedTagKeys.length > 0 ? 'pr-24' : 'pr-14'
            )}
          >
            <DialogTitle className="flex items-center gap-2 text-left text-lg font-semibold">
              <Tags className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              Filter by tags
            </DialogTitle>
            <DialogDescription className="text-left text-sm text-muted-foreground">
              Recipes must match all selected tags (any casing on the recipe matches).
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            {tagEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags in your recipes yet.</p>
            ) : (
              <div className="space-y-6">
                {tagEntries.some((e) => CUISINE_KEYS.has(e.key)) ? (
                  <div>
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Cuisine
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {tagEntries
                        .filter((e) => CUISINE_KEYS.has(e.key))
                        .map((e) => (
                          <button
                            key={e.key}
                            type="button"
                            onClick={() => toggleTag(e.key)}
                            className={tagFilterPillClass(e.key)}
                          >
                            {e.label}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : null}

                {tagEntries.some((e) => DIETARY_KEYS.has(e.key)) ? (
                  <div>
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Dietary
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {tagEntries
                        .filter((e) => DIETARY_KEYS.has(e.key))
                        .map((e) => (
                          <button
                            key={e.key}
                            type="button"
                            onClick={() => toggleTag(e.key)}
                            className={tagFilterPillClass(e.key)}
                          >
                            {e.label}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : null}

                {tagEntries.some((e) => MEAL_KEYS.has(e.key)) ? (
                  <div>
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Meal type
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {tagEntries
                        .filter((e) => MEAL_KEYS.has(e.key))
                        .map((e) => (
                          <button
                            key={e.key}
                            type="button"
                            onClick={() => toggleTag(e.key)}
                            className={tagFilterPillClass(e.key)}
                          >
                            {e.label}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : null}

                {tagEntries.some((e) => !ALL_GROUPED_TAG_KEYS.has(e.key)) ? (
                  <div>
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Other
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {tagEntries
                        .filter((e) => !ALL_GROUPED_TAG_KEYS.has(e.key))
                        .map((e) => (
                          <button
                            key={e.key}
                            type="button"
                            onClick={() => toggleTag(e.key)}
                            className={tagFilterPillClass(e.key)}
                          >
                            {e.label}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Search, sort, and filters on one row */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="relative min-w-0 flex-1 lg:max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search recipes by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 py-2 pl-10 pr-10 text-base md:text-sm"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="tabular-nums text-muted-foreground">
              {filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}
            </span>
          </div>

          <div className="relative">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-') as [
                  'name' | 'date' | 'cookTime',
                  'asc' | 'desc',
                ];
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
              }}
              aria-label="Sort recipes"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'default' }),
                'h-10 min-h-10 min-w-[10.5rem] cursor-pointer appearance-none bg-background pr-9 pl-3 text-left text-sm font-medium shadow-sm'
              )}
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="cookTime-asc">Quick to cook</option>
              <option value="cookTime-desc">Long to cook</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>

          <TooltipTrigger label="Filter by tags">
            <Button
              type="button"
              variant={selectedTagKeys.length > 0 ? 'default' : 'outline'}
              onClick={() => setTagFilterOpen(true)}
              className="h-10 gap-2 px-3"
              aria-label="Filter by tags"
            >
              <Filter className="size-4 shrink-0" />
              <span>Tags</span>
              {selectedTagKeys.length > 0 && (
                <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs font-medium tabular-nums text-primary-foreground">
                  {selectedTagKeys.length}
                </span>
              )}
            </Button>
          </TooltipTrigger>
        </div>
      </div>
      
      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-0 overflow-hidden">
              <Skeleton className="h-[5.5rem] w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="mt-3 h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-10 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-card shadow-sm">
            <Utensils className="size-8 text-muted-foreground" />
          </div>
          {user ? (
            <>
              <p className="text-gray-600 mb-2 font-medium">You don't have any recipes yet.</p>
              <p className="text-gray-500 mb-4">
                Tap the <span className="font-medium text-foreground">+</span> button in the corner to import your first recipe.
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-600 mb-2 font-medium">Please log in to view your recipes.</p>
              <p className="text-gray-500 mb-4">
                Sign in to save and manage your personal recipe collection.
              </p>
            </>
          )}
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-md text-center">
          <p className="text-gray-600 mb-2 font-medium">No recipes match your current filters.</p>
          <p className="text-gray-500 mb-4">
            Try adjusting your search or filter criteria.
          </p>
          <button
            onClick={clearAllFilters}
            className="btn btn-secondary inline-flex items-center"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav
              className="mt-8 flex flex-wrap items-center justify-center gap-0.5 sm:gap-1"
              aria-label="Recipe list pagination"
            >
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cn(
                  'icon-hit shrink-0 text-primary',
                  'disabled:pointer-events-none disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none'
                )}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              {buildPaginationItems(safePage, totalPages).map((item, idx) =>
                item === 'ellipsis' ? (
                  <span
                    key={`e-${idx}`}
                    className="inline-flex min-h-10 min-w-8 items-center justify-center px-0.5 text-sm text-muted-foreground select-none"
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-label={`Page ${item}`}
                    aria-current={item === safePage ? 'page' : undefined}
                    className={cn(
                      'icon-hit tabular-nums text-sm font-semibold',
                      item === safePage ? 'icon-hit--accent' : 'text-foreground'
                    )}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={cn(
                  'icon-hit shrink-0 text-primary',
                  'disabled:pointer-events-none disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none'
                )}
                aria-label="Next page"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
};

export default Home;