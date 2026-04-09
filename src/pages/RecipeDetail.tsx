import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getRecipeById,
  updateRecipeTags,
  updateRecipeTitle,
  deleteRecipe,
  replaceRecipeInstructions,
} from '../services/recipe/recipeService';
import { getMasterGroceryList, addIngredientsToList } from '../services/grocery/groceryService';
import { Recipe } from '../types/recipe';
import { RecipeVideoEmbed } from '@/components/RecipeVideoEmbed';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Minus,
  Pencil,
  Plus,
  ShoppingBasket,
  Tags,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import '../assets/list-animations.css';
import '../assets/grocery-animations.css';
import { TooltipTrigger } from '@/components/ui/tooltip';

const RecipeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  
  // Recipe state
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Grocery list state
  const [creatingList, setCreatingList] = useState(false);
  const [listCreated, setListCreated] = useState(false);
  
  // Servings state
  const [servings, setServings] = useState(2);
  const [originalServings, setOriginalServings] = useState<number | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
  
  const [newTag, setNewTag] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [isEditingRecipe, setIsEditingRecipe] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [instructionDrafts, setInstructionDrafts] = useState<string[]>([]);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Refs
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // ===== HELPER FUNCTIONS =====

  const getRecipeSourceInfo = () => {
    if (!recipe?.sourceUrl) {
      return {
        icon: <ImageIcon className="mr-1 size-4 shrink-0 text-muted-foreground" />,
        text: 'Imported from image',
        isLink: false,
        href: '#',
      };
    }

    const sourceUrl = recipe.sourceUrl.trim();

    if (sourceUrl.includes('instagram.com')) {
      const instagramUrlMatch = sourceUrl.match(/(https?:\/\/(?:www\.)?instagram\.com\/[^\s]+)/);
      const actualUrl = instagramUrlMatch ? instagramUrlMatch[1] : sourceUrl;
      const usernameMatch = sourceUrl.match(/@([^\s-]+)/);
      const username = usernameMatch ? usernameMatch[1] : null;

      return {
        icon: <LinkIcon className="mr-1 size-4 shrink-0 text-pink-600" />,
        text: username ? `@${username}'s Post` : 'Instagram Post',
        isLink: true,
        href: actualUrl,
      };
    }

    if (sourceUrl.toLowerCase().includes('pdf:') || sourceUrl.toLowerCase().includes('.pdf')) {
      return {
        icon: <FileText className="mr-1 size-4 shrink-0 text-red-500" />,
        text: 'Imported from PDF',
        isLink: false,
        href: '#',
      };
    }

    return {
      icon: <LinkIcon className="mr-1 size-4 shrink-0 text-blue-600" />,
      text: 'View Original Recipe',
      isLink: true,
      href: sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`,
    };
  };

  // ===== DATA FETCHING =====
  
  useEffect(() => {
    fetchRecipeData();
  }, [id]);

  const fetchRecipeData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!id) {
        setError('Recipe ID not found');
        setLoading(false);
        return;
      }

      const fetchedRecipe = await getRecipeById(id);
      setRecipe(fetchedRecipe);
      
      // Set original servings from the recipe
      if (fetchedRecipe.servings) {
        setOriginalServings(fetchedRecipe.servings);
        setServings(fetchedRecipe.servings);
      }
      
    } catch (err) {
      console.error('Error fetching recipe:', err);
      setError('Failed to load recipe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Common tag suggestions
  const tagSuggestions = [
    // Cuisines
    'Italian', 'Mexican', 'Chinese', 'Indian', 'Japanese', 'Thai', 'Mediterranean', 'French',
    // Dietary
    'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Low-Carb',
    // Meal types
    'Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Appetizer', 'Side Dish', 'Soup', 'Salad'
  ];
  
  // Effect to handle clicking outside the tag suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSuggestions && newTagInputRef.current && !newTagInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);
  
  // Effect to handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Enter to save tags when editing tags
      if (event.ctrlKey && event.key === 'Enter' && isEditingRecipe && !savingRecipe) {
        handleSaveRecipeEdit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditingRecipe, savingRecipe]);

  // ===== UTILITY FUNCTIONS =====
  
  // Compute scaled ingredients dynamically
  const getScaledIngredients = () => {
    if (!recipe || !recipe.ingredients) return [];
    // Use originalServings if available, otherwise fallback to 2
    const baseServings = originalServings || 2;
    const scaleFactor = servings / baseServings;
    return recipe.ingredients.map(ingredient => {
      const numericQuantity = parseFloat(ingredient.quantity || '0');
      let displayQuantity = ingredient.quantity;
      if (!isNaN(numericQuantity)) {
        const scaledValue = numericQuantity * scaleFactor;
        displayQuantity = scaledValue === Math.floor(scaledValue)
          ? scaledValue.toString()
          : scaledValue.toFixed(1).replace(/\.0$/, '');
      }
      return {
        ...ingredient,
        displayQuantity
      };
    });
  };
  
  // Toggle ingredient selection
  const toggleIngredient = (ingredientId: string) => {
    setSelectedIngredients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ingredientId)) {
        newSet.delete(ingredientId);
      } else {
        newSet.add(ingredientId);
      }
      return newSet;
    });
  };
  
  // Sort ingredients to move selected ones to the bottom
  const getSortedIngredients = () => {
    const ingredients = getScaledIngredients();
    return [...ingredients].sort((a, b) => {
      const aSelected = selectedIngredients.has(a.id || '');
      const bSelected = selectedIngredients.has(b.id || '');
      if (aSelected && !bSelected) return 1;
      if (!aSelected && bSelected) return -1;
      return 0;
    });
  };

  // ===== EVENT HANDLERS =====
  
  // Tag Management
  // Handle adding a new tag
  const handleAddTag = () => {
    if (!recipe || !newTag.trim()) return;
    
    // Check if we've reached the 8-tag limit
    if (recipe.tags.length >= 8) {
      setNewTag('');
      addNotification('warning', 'Maximum of 8 tags allowed per recipe');
      return;
    }
    
    const trimmedTag = newTag.trim();
    // Capitalize first letter of each word
    const formattedTag = trimmedTag
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Check if tag already exists (case insensitive)
    if (recipe.tags.some(tag => tag.toLowerCase() === formattedTag.toLowerCase())) {
      setNewTag('');
      addNotification('info', 'Tag already exists');
      return;
    }
    
    // Update recipe with new tag
    setRecipe({
      ...recipe,
      tags: [...recipe.tags, formattedTag]
    });
    
    setNewTag('');
    if (newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  };
  
  // Handle removing a tag
  const handleRemoveTag = (tagToRemove: string) => {
    if (!recipe) return;
    
    setRecipe({
      ...recipe,
      tags: recipe.tags.filter(tag => tag !== tagToRemove)
    });
  };
  
  const startRecipeEdit = () => {
    if (!recipe) return;
    setNewTitle(recipe.title);
    setInstructionDrafts(recipe.instructions.map((i) => i.description));
    setNewTag('');
    setShowSuggestions(false);
    setIsEditingRecipe(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleCancelRecipeEdit = async () => {
    if (!id) return;
    try {
      const data = await getRecipeById(id);
      setRecipe(data);
      setNewTitle(data.title);
      setIsEditingRecipe(false);
      setShowSuggestions(false);
      setNewTag('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRecipeEdit = async () => {
    if (!recipe || !id) return;
    if (!newTitle.trim()) {
      addNotification('warning', 'Please enter a recipe title.');
      return;
    }
    const trimmedInstructions = instructionDrafts.map((s) => s.trim()).filter(Boolean);
    if (trimmedInstructions.length === 0) {
      addNotification('warning', 'Add at least one instruction step, or cancel editing.');
      return;
    }

    setSavingRecipe(true);
    try {
      await updateRecipeTitle(id, newTitle.trim());
      await replaceRecipeInstructions(id, trimmedInstructions);
      await updateRecipeTags(id, recipe.tags);
      const updated = await getRecipeById(id);
      setRecipe(updated);
      setIsEditingRecipe(false);
      setShowSuggestions(false);
      setNewTag('');
      addNotification('success', 'Recipe updated.');
    } catch (err) {
      addNotification(
        'error',
        err instanceof Error ? err.message : 'Failed to update recipe.'
      );
      console.error(err);
    } finally {
      setSavingRecipe(false);
    }
  };

  const moveInstructionStep = (index: number, direction: 'up' | 'down') => {
    setInstructionDrafts((prev) => {
      const next = [...prev];
      const j = direction === 'up' ? index - 1 : index + 1;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  // Handle recipe deletion
  const handleDeleteRecipe = async () => {
    if (!recipe || !id) return;

    setDeleting(true);
    try {
      await deleteRecipe(id);
      // Navigate back to homepage after successful deletion
      navigate('/');
    } catch (err) {
      setError('Failed to delete recipe. Please try again.');
      console.error(err);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  
  // Removed handleAddSuggestion function as we're keeping suggestions as reference only
  
  const handleCreateGroceryList = async () => {
    if (!recipe || !originalServings) return;
    
    setCreatingList(true);
    
    try {
      // Use the dynamically calculated scaled ingredients for the grocery list
      const groceryIngredients = getScaledIngredients().map(ingredient => ({
        ...ingredient,
        quantity: ingredient.displayQuantity
      }));
      
      // Get or create master list and add ingredients to it
      const masterList = await getMasterGroceryList();
      
      // Add ingredients to master list with aggregation
      await addIngredientsToList(masterList.id, recipe.id, recipe.title, groceryIngredients);
      
      setListCreated(true);
      
      // Show success notification and navigate to grocery lists page
      addNotification('success', 'Recipe added to grocery list successfully!');
      
      // Navigate to grocery lists page after a short delay
      setTimeout(() => {
        navigate('/grocery-list');
      }, 1000);
    } catch (err) {
      setError('Failed to add to grocery list. Please try again.');
      console.error(err);
    } finally {
      setCreatingList(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error || !recipe) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-md">
        {error || 'Recipe not found'}
        <Link to="/" className="block mt-4 text-primary hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <TooltipTrigger label="Back to recipes">
          <Link
            to="/"
            className="icon-hit text-primary"
            aria-label="Back to recipes"
          >
            <ArrowLeft className="size-5" />
          </Link>
        </TooltipTrigger>

        <div className="flex items-center gap-2">
          {isEditingRecipe ? (
            <>
              <TooltipTrigger label="Save changes">
                <button
                  type="button"
                  onClick={handleSaveRecipeEdit}
                  disabled={savingRecipe}
                  className="icon-hit text-primary"
                  aria-label="Save changes"
                >
                  {savingRecipe ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
                </button>
              </TooltipTrigger>
              <TooltipTrigger label="Cancel editing">
                <button
                  type="button"
                  onClick={handleCancelRecipeEdit}
                  disabled={savingRecipe}
                  className="icon-hit text-muted-foreground"
                  aria-label="Cancel editing"
                >
                  <X className="size-5" />
                </button>
              </TooltipTrigger>
            </>
          ) : (
            <TooltipTrigger label="Edit recipe">
              <button
                type="button"
                onClick={startRecipeEdit}
                className="icon-hit text-muted-foreground hover:text-primary"
                aria-label="Edit recipe"
              >
                <Pencil className="size-5" />
              </button>
            </TooltipTrigger>
          )}
          <TooltipTrigger label="Delete recipe">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="icon-hit icon-hit--destructive text-destructive"
              aria-label="Delete recipe"
            >
              <Trash2 className="size-5" />
            </button>
          </TooltipTrigger>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">        
        <div className="p-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex min-w-0 flex-1 items-center">
              {isEditingRecipe ? (
                <input
                  type="text"
                  ref={titleInputRef}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mr-2 w-full min-w-0 border-b border-border bg-transparent text-3xl font-bold focus:border-primary focus:outline-none"
                  disabled={savingRecipe}
                  aria-label="Recipe title"
                />
              ) : (
                <h1 className="text-3xl font-bold">{recipe.title}</h1>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-foreground">
              <Utensils className="size-5 text-primary" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Servings</span>
                <div className="flex items-center rounded-full border border-border bg-muted/30 px-0.5 py-0.5">
                  <TooltipTrigger label="Decrease servings">
                    <button
                      type="button"
                      onClick={() => setServings(Math.max(1, servings - 1))}
                      className="icon-hit text-primary"
                      aria-label="Decrease servings"
                    >
                      <Minus className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <span className="min-w-[1.75rem] px-1 text-center font-bold tabular-nums">{servings}</span>
                  <TooltipTrigger label="Increase servings">
                    <button
                      type="button"
                      onClick={() => setServings(servings + 1)}
                      className="icon-hit text-primary"
                      aria-label="Increase servings"
                    >
                      <Plus className="size-4" />
                    </button>
                  </TooltipTrigger>
                </div>
              </div>
            </div>
          </div>
          
          {recipe.description && (
            <p className="text-gray-600 mb-4 text-sm italic">{recipe.description}</p>
          )}

          {recipe.videoUrl ? (
            <section className="mb-6" aria-labelledby="recipe-video-heading">
              <h2
                id="recipe-video-heading"
                className="mb-2 text-sm font-semibold tracking-tight text-foreground"
              >
                Recipe video
              </h2>
              <RecipeVideoEmbed src={recipe.videoUrl} poster={recipe.imageUrl} />
            </section>
          ) : null}
          
          {(recipe.prepTime || recipe.cookTime) && (
            <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              {recipe.prepTime && (
                <div className="flex items-center text-gray-700 bg-white px-3 py-2 rounded-md shadow-sm">
                  <Clock className="mr-2 size-4 text-primary" />
                  <span>Prep: <strong>{recipe.prepTime} min</strong></span>
                </div>
              )}
              
              {recipe.cookTime && (
                <div className="flex items-center text-gray-700 bg-white px-3 py-2 rounded-md shadow-sm">
                  <Clock className="mr-2 size-4 text-primary" />
                  <span>Cook: <strong>{recipe.cookTime} min</strong></span>
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-0">
            <div className="md:col-span-1 md:pr-8">
              <h2 className="mb-3 border-b border-border pb-2 text-lg font-semibold">Ingredients</h2>
              <ul className="relative flex flex-col gap-4">
                {getSortedIngredients().map((ingredient, index) => {
                  const isSelected = selectedIngredients.has(ingredient.id || '');
                  const qtyParts = [ingredient.displayQuantity, ingredient.unit].filter(Boolean).join(' ');
                  return (
                    <li
                      key={ingredient.id || index}
                      className={cn(
                        'flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5 transition-all duration-200 ease-in-out',
                        isSelected && 'opacity-70'
                      )}
                    >
                      <TooltipTrigger
                        label={isSelected ? 'Mark ingredient as not used' : 'Mark ingredient as used'}
                      >
                        <button
                          type="button"
                          onClick={() => ingredient.id && toggleIngredient(ingredient.id)}
                          className={cn(
                            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ease-in-out',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/50'
                          )}
                          aria-label={isSelected ? 'Mark as not used' : 'Mark as used'}
                        >
                          {isSelected && <Check className="size-3 transition-opacity duration-200" />}
                        </button>
                      </TooltipTrigger>
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                        <div
                          className={cn(
                            'min-w-0 flex-1 text-left transition-all duration-500',
                            isSelected && 'text-muted-foreground line-through'
                          )}
                        >
                          <span className="font-medium">
                            {ingredient.name.charAt(0).toUpperCase() + ingredient.name.slice(1)}
                          </span>
                          {ingredient.notes && (
                            <span className="mt-0.5 block text-xs italic text-muted-foreground">
                              ({ingredient.notes})
                            </span>
                          )}
                        </div>
                        {qtyParts ? (
                          <div
                            className={cn(
                              'shrink-0 text-right text-sm tabular-nums text-muted-foreground',
                              isSelected && 'line-through'
                            )}
                          >
                            {qtyParts}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            <div className="md:col-span-2 md:border-l md:border-border md:pl-8">
              <h2 className="mb-3 border-b border-border pb-2 text-lg font-semibold">Instructions</h2>
              {isEditingRecipe ? (
                <div className="space-y-4">
                  {instructionDrafts.map((text, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="w-5 shrink-0 pt-2 text-right text-sm font-medium leading-snug tabular-nums text-emerald-600 dark:text-emerald-500">
                        {index + 1}
                      </span>
                      <textarea
                        value={text}
                        onChange={(e) => {
                          const v = e.target.value;
                          setInstructionDrafts((prev) => {
                            const copy = [...prev];
                            copy[index] = v;
                            return copy;
                          });
                        }}
                        className="min-h-[4.5rem] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        disabled={savingRecipe}
                      />
                      <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                        <TooltipTrigger label="Move step up">
                          <button
                            type="button"
                            disabled={index === 0 || savingRecipe}
                            onClick={() => moveInstructionStep(index, 'up')}
                            className="icon-hit text-muted-foreground disabled:pointer-events-none disabled:opacity-30"
                            aria-label="Move step up"
                          >
                            <ArrowUp className="size-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipTrigger label="Move step down">
                          <button
                            type="button"
                            disabled={index === instructionDrafts.length - 1 || savingRecipe}
                            onClick={() => moveInstructionStep(index, 'down')}
                            className="icon-hit text-muted-foreground disabled:pointer-events-none disabled:opacity-30"
                            aria-label="Move step down"
                          >
                            <ArrowDown className="size-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipTrigger label="Remove step">
                          <button
                            type="button"
                            disabled={savingRecipe || instructionDrafts.length <= 1}
                            onClick={() =>
                              setInstructionDrafts((prev) => prev.filter((_, i) => i !== index))
                            }
                            className="icon-hit icon-hit--destructive disabled:pointer-events-none disabled:opacity-30"
                            aria-label="Remove step"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </TooltipTrigger>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setInstructionDrafts((prev) => [...prev, ''])}
                    disabled={savingRecipe}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    <Plus className="size-4" />
                    Add step
                  </button>
                </div>
              ) : (
                <ol className="space-y-4">
                  {recipe.instructions.map((instruction, index) => (
                    <li key={instruction.id ?? index} className="flex items-baseline gap-2">
                      <span className="w-5 shrink-0 text-right text-sm font-medium leading-snug tabular-nums text-emerald-600 dark:text-emerald-500">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-relaxed">
                        {instruction.description.charAt(0).toUpperCase() +
                          instruction.description.slice(1)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          
          {/* Tags */}
          <div className="mt-8 pt-4 border-t border-gray-200">
            <div className="mb-2">
              <div className="flex items-center mb-2">
                <div className="flex items-center flex-grow">
                  <Tags className="mr-2 size-5 text-primary" />
                  <h3 className="font-medium mr-2">Tags:</h3>
                
                  {recipe.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 flex-grow relative">
                      {recipe.tags.map((tag, index) => (
                        <div 
                          key={index} 
                          className={`inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm font-medium text-foreground ${isEditingRecipe ? '' : 'cursor-default'}`}
                        >
                          {tag}
                          {isEditingRecipe && (
                            <button 
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-2 text-gray-500 hover:text-red-500"
                              disabled={savingRecipe}
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !isEditingRecipe && (
                      <span className="text-gray-500 text-sm italic mt-0.5">No tags added yet!</span>
                    )
                  )}
                </div>

                {isEditingRecipe ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddTag();
                    }}
                    className="inline-flex items-center"
                  >
                    <input
                      type="text"
                      ref={newTagInputRef}
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newTag.trim() && !savingRecipe) {
                            handleAddTag();
                          }
                        }
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Add a tag"
                      className="input mr-2 w-48"
                      disabled={savingRecipe}
                    />
                  </form>
                ) : null}
              </div>
            </div>
            
            {/* Tag suggestions as a row */}
            {showSuggestions && isEditingRecipe && (
              <div className="mt-3 p-2 bg-white">
                <div className="flex flex-wrap gap-1 items-center">
                  <p className="text-xs text-gray-500 mr-2">Suggestions:</p>
                  {tagSuggestions
                    .filter(tag => !recipe.tags.includes(tag))
                    .slice(0, 12)
                    .map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center rounded-full border border-dashed border-border/50 bg-muted/30 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center text-sm leading-relaxed text-foreground">
              {(() => {
                const sourceInfo = getRecipeSourceInfo();
                return (
                  <span className="flex min-w-0 flex-wrap items-center gap-1">
                    {sourceInfo.icon}
                    {sourceInfo.isLink ? (
                      <a
                        href={sourceInfo.href}
                        target={sourceInfo.href.startsWith('http') ? '_blank' : '_self'}
                        rel={sourceInfo.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={(e) => {
                          if (sourceInfo.href === '#') {
                            e.preventDefault();
                          }
                        }}
                      >
                        {sourceInfo.text}
                      </a>
                    ) : (
                      <span className="text-sm text-foreground">{sourceInfo.text}</span>
                    )}
                  </span>
                );
              })()}
            </div>
            <div className="flex justify-end sm:shrink-0">
              <TooltipTrigger
                label={
                  creatingList
                    ? 'Adding to grocery list…'
                    : listCreated
                      ? 'Added to grocery list'
                      : 'Add to grocery list'
                }
              >
                <button
                  type="button"
                  onClick={handleCreateGroceryList}
                  disabled={creatingList || listCreated}
                  className={cn(
                    'icon-hit',
                    listCreated && 'text-green-600 dark:text-green-500',
                    !listCreated && 'text-primary'
                  )}
                  aria-label={
                    creatingList
                      ? 'Adding to grocery list'
                      : listCreated
                        ? 'Added to grocery list'
                        : 'Add to grocery list'
                  }
                >
                  {creatingList ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : listCreated ? (
                    <Check className="size-5" aria-hidden />
                  ) : (
                    <ShoppingBasket className="size-5" aria-hidden />
                  )}
                </button>
              </TooltipTrigger>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={(open) => !open && !deleting && setShowDeleteConfirm(false)}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete recipe</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{recipe?.title}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleDeleteRecipe} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecipeDetail;