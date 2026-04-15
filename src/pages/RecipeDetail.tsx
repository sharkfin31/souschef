import { useState, useEffect, useLayoutEffect, useRef, type ChangeEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getRecipeById,
  updateRecipeTags,
  updateRecipeTitle,
  deleteRecipe,
  replaceRecipeInstructions,
  clearRecipeVideoUrl,
} from '../services/recipe/recipeService';
import { uploadRecipeVideoFile } from '../services/api/recipeVideoApi';
import { getMasterGroceryList, addIngredientsToList } from '../services/grocery/groceryService';
import { Recipe } from '../types/recipe';
import { HugeiconsIcon } from '@hugeicons/react';
import { ShoppingBasketAdd03Icon } from '@hugeicons/core-free-icons';
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
  Play,
  PictureInPicture2,
  Film,
  Plus,
  Tags,
  Trash2,
  Upload,
  Utensils,
  Video,
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

const MAX_RECIPE_VIDEO_BYTES = 50 * 1024 * 1024;

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

  const [savingVideo, setSavingVideo] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [deleteVideoConfirmOpen, setDeleteVideoConfirmOpen] = useState(false);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Refs
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const recipeVideoRef = useRef<HTMLVideoElement>(null);
  const recipeVideoMenuRef = useRef<HTMLDivElement>(null);

  /** Desktop (lg+): in-page vs PiP. Sub-lg: always treated as embedded in layout. */
  const [recipeVideoMode, setRecipeVideoMode] = useState<'embedded' | 'pip'>('embedded');
  const [isLgViewport, setIsLgViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  const [recipeVideoPlayMenuOpen, setRecipeVideoPlayMenuOpen] = useState(false);

  const effectiveRecipeVideoMode: 'embedded' | 'pip' =
    isLgViewport ? recipeVideoMode : 'embedded';

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsLgViewport(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem('souschef-recipe-video-mode');
      if (saved === 'embedded' || saved === 'pip') {
        setRecipeVideoMode(saved);
        return;
      }
    } catch {
      /* ignore */
    }
    setRecipeVideoMode(window.matchMedia('(max-width: 1023px)').matches ? 'embedded' : 'pip');
  }, []);

  const persistRecipeVideoMode = (mode: 'embedded' | 'pip') => {
    setRecipeVideoMode(mode);
    try {
      localStorage.setItem('souschef-recipe-video-mode', mode);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const v = recipeVideoRef.current;
    if (effectiveRecipeVideoMode === 'embedded' && v && document.pictureInPictureElement === v) {
      void document.exitPictureInPicture().catch(() => {});
    }
  }, [effectiveRecipeVideoMode]);

  useEffect(() => {
    if (!recipeVideoPlayMenuOpen) return;
    const close = (e: MouseEvent) => {
      const el = recipeVideoMenuRef.current;
      if (el && !el.contains(e.target as Node)) {
        setRecipeVideoPlayMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRecipeVideoPlayMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [recipeVideoPlayMenuOpen]);

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
      addNotification('warning', 'Tags: limit reached', {
        description: 'Remove a tag before adding another (maximum 8 per recipe).',
      });
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
      addNotification('info', 'Tag already on recipe', {
        description: `“${formattedTag}” is already in the list.`,
      });
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

  const closeMediaModal = () => {
    setMediaModalOpen(false);
    setPendingVideoFile(null);
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = '';
    }
  };

  const handleVideoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size > MAX_RECIPE_VIDEO_BYTES) {
      addNotification('error', 'Video upload: file too large', {
        description: 'Choose an MP4, WebM, or MOV under 50 MB, then try again.',
      });
      e.target.value = '';
      setPendingVideoFile(null);
      return;
    }
    setPendingVideoFile(file ?? null);
  };

  const handleSubmitVideoUpload = async () => {
    if (!id || !pendingVideoFile) {
      addNotification('warning', 'Video upload: no file', {
        description: 'Use Manage media → Upload and pick a video before confirming.',
      });
      return;
    }
    setSavingVideo(true);
    try {
      await uploadRecipeVideoFile(id, pendingVideoFile);
      const updated = await getRecipeById(id);
      setRecipe(updated);
      closeMediaModal();
      addNotification('success', 'Video uploaded and linked to this recipe.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addNotification('error', 'Video upload failed', {
        description:
          msg.length > 200
            ? `${msg.slice(0, 197)}…`
            : `${msg} If this persists, try a smaller file or a different format.`,
      });
    } finally {
      setSavingVideo(false);
    }
  };

  const handlePlayRecipeVideoPip = async () => {
    const v = recipeVideoRef.current;
    if (!v || !recipe?.videoUrl) return;
    try {
      if (document.pictureInPictureElement === v) {
        await document.exitPictureInPicture();
        return;
      }
      if (!document.pictureInPictureEnabled) {
        addNotification('warning', 'Picture-in-picture not available', {
          description:
            'This browser or device does not support PiP. Use Play → “On this page” to watch inline.',
        });
        return;
      }
      await v.play();
      await v.requestPictureInPicture();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addNotification('error', 'Picture-in-picture could not start', {
        description: `${msg} Try Play → “On this page”, or use the on-page player controls.`,
      });
    }
  };

  const handleDesktopRecipeVideoPlayChoice = async (mode: 'embedded' | 'pip') => {
    persistRecipeVideoMode(mode);
    setRecipeVideoPlayMenuOpen(false);
    const v = recipeVideoRef.current;
    if (mode === 'embedded') {
      if (v && document.pictureInPictureElement === v) {
        await document.exitPictureInPicture().catch(() => {});
      }
      requestAnimationFrame(() => {
        void v?.play().catch(() => {});
        v?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      return;
    }
    await handlePlayRecipeVideoPip();
  };

  const handleConfirmDeleteVideo = async () => {
    if (!id) return;
    setSavingVideo(true);
    try {
      await clearRecipeVideoUrl(id);
      const updated = await getRecipeById(id);
      setRecipe(updated);
      setDeleteVideoConfirmOpen(false);
      setMediaModalOpen(false);
      addNotification('success', 'Video removed from this recipe.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addNotification('error', 'Remove video failed', {
        description: msg.length > 220 ? `${msg.slice(0, 217)}…` : msg,
      });
    } finally {
      setSavingVideo(false);
    }
  };

  const handleSaveRecipeEdit = async () => {
    if (!recipe || !id) return;
    if (!newTitle.trim()) {
      addNotification('warning', 'Save recipe: title missing', {
        description: 'Enter a title in the heading field before saving.',
      });
      return;
    }
    const trimmedInstructions = instructionDrafts.map((s) => s.trim()).filter(Boolean);
    if (trimmedInstructions.length === 0) {
      addNotification('warning', 'Save recipe: no steps', {
        description: 'Add at least one instruction step, or cancel editing.',
      });
      return;
    }

    setSavingRecipe(true);
    try {
      await updateRecipeTitle(id, newTitle.trim());
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addNotification('error', 'Save recipe: title failed', {
        description: msg.length > 200 ? `${msg.slice(0, 197)}…` : msg,
      });
      setSavingRecipe(false);
      return;
    }
    try {
      await replaceRecipeInstructions(id, trimmedInstructions);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addNotification('error', 'Save recipe: instructions failed', {
        description: msg.length > 200 ? `${msg.slice(0, 197)}…` : msg,
      });
      setSavingRecipe(false);
      return;
    }
    try {
      await updateRecipeTags(id, recipe.tags);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addNotification('error', 'Save recipe: tags failed', {
        description:
          (msg.length > 200 ? `${msg.slice(0, 197)}…` : msg) +
          ' Title and steps may have saved; refresh the page to confirm.',
      });
      setSavingRecipe(false);
      return;
    }
    try {
      const updated = await getRecipeById(id);
      setRecipe(updated);
      setIsEditingRecipe(false);
      setShowSuggestions(false);
      setNewTag('');
      addNotification('success', 'Recipe updated.');
    } catch (err) {
      addNotification(
        'error',
        'Save recipe: reload failed',
        {
          description:
            err instanceof Error
              ? `${err.message} Changes may still be on the server — try leaving and opening this recipe again.`
              : 'Could not reload the recipe after saving.',
        }
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
        <TooltipTrigger label="All recipes">
          <Link
            to="/"
            className="icon-hit text-muted-foreground hover:text-primary"
            aria-label="Back to recipes"
          >
            <ArrowLeft className="size-5" />
          </Link>
        </TooltipTrigger>

        <div className="flex items-center gap-2">
          {isEditingRecipe ? (
            <>
              <TooltipTrigger label="Save">
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
              <TooltipTrigger label="Cancel">
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
          {recipe.videoUrl && isLgViewport ? (
            <div ref={recipeVideoMenuRef} className="relative">
              <TooltipTrigger label="Play recipe video">
                <button
                  type="button"
                  onClick={() => setRecipeVideoPlayMenuOpen((o) => !o)}
                  disabled={savingRecipe || savingVideo}
                  className={cn(
                    'icon-hit text-muted-foreground hover:text-primary disabled:pointer-events-none disabled:opacity-50',
                    recipeVideoPlayMenuOpen && 'text-primary'
                  )}
                  aria-expanded={recipeVideoPlayMenuOpen}
                  aria-haspopup="true"
                  aria-controls="recipe-video-play-menu"
                  aria-label="Recipe video play options"
                >
                  <Play className="size-5" />
                </button>
              </TooltipTrigger>
              {recipeVideoPlayMenuOpen ? (
                <div
                  id="recipe-video-play-menu"
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(17rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-3 text-left shadow-lg"
                >
                  <div
                    className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1"
                    role="group"
                    aria-label="Video playback mode"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleDesktopRecipeVideoPlayChoice('embedded')}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
                        recipeVideoMode === 'embedded'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Film className="size-3.5 shrink-0" aria-hidden />
                      On this page
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleDesktopRecipeVideoPlayChoice('pip')}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
                        recipeVideoMode === 'pip'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <PictureInPicture2 className="size-3.5 shrink-0" aria-hidden />
                      PiP
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <TooltipTrigger label="Manage media">
            <button
              type="button"
              onClick={() => {
                setPendingVideoFile(null);
                if (videoFileInputRef.current) videoFileInputRef.current.value = '';
                setMediaModalOpen(true);
              }}
              disabled={savingRecipe || savingVideo}
              className="icon-hit text-muted-foreground hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              aria-label="Add or manage recipe video"
            >
              <Video className="size-5" />
            </button>
          </TooltipTrigger>
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
            
            <div className="flex items-center gap-4 text-foreground">
              <Utensils className="size-5 text-primary" />
              <div className="flex items-center gap-2">
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
            <div
              className={cn(
                effectiveRecipeVideoMode === 'embedded'
                  ? 'mb-6 w-full max-w-3xl'
                  : 'pointer-events-none fixed top-0 left-0 z-[-1] h-px w-px overflow-hidden opacity-0'
              )}
            >
              <video
                ref={recipeVideoRef}
                src={recipe.videoUrl}
                poster={recipe.imageUrl ?? undefined}
                className={cn(
                  'w-full rounded-lg border border-border bg-black object-contain',
                  effectiveRecipeVideoMode === 'embedded'
                    ? 'aspect-video max-h-[min(70vh,520px)]'
                    : 'h-px w-px'
                )}
                playsInline
                controls={effectiveRecipeVideoMode === 'embedded'}
                preload="metadata"
                {...(effectiveRecipeVideoMode === 'pip'
                  ? { 'aria-hidden': true as const }
                  : { 'aria-label': 'Recipe video' })}
              />
            </div>
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
                    <HugeiconsIcon
                      icon={ShoppingBasketAdd03Icon}
                      size={20}
                      strokeWidth={1.75}
                      className="text-current"
                      aria-hidden
                    />
                  )}
                </button>
              </TooltipTrigger>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={mediaModalOpen} onOpenChange={(open) => !open && closeMediaModal()}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton>
          <div className="border-b border-border bg-muted/40 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                <Video className="size-6" aria-hidden />
              </div>
              <DialogHeader className="flex flex-1 flex-col justify-center space-y-0 text-left">
                <DialogTitle className="text-left leading-snug">Manage Recipe Video</DialogTitle>
              </DialogHeader>
            </div>
          </div>

          <div className="p-6">
            {!recipe.videoUrl ? (
              <input
                ref={videoFileInputRef}
                type="file"
                accept="video/*,.mp4,.webm,.mov,.m4v"
                className="sr-only"
                aria-label="Choose video file"
                onChange={handleVideoFileChange}
              />
            ) : null}

            <div className="grid gap-4">
              {!recipe.videoUrl ? (
                <button
                  type="button"
                  onClick={() => !savingVideo && videoFileInputRef.current?.click()}
                  disabled={savingVideo}
                  className={cn(
                    'recipe-modal-tile group flex min-h-[8.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-muted/20 p-5 text-center shadow-sm transition',
                    'hover:border-primary/30 hover:bg-muted/35 hover:shadow-md',
                    'outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0',
                    'disabled:pointer-events-none disabled:opacity-50',
                    'sm:mx-auto sm:max-w-sm'
                  )}
                >
                  <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary/15">
                    <Upload className="size-5" aria-hidden />
                  </div>
                  <span className="text-sm font-medium tracking-tight text-foreground">Upload</span>
                  <span className="text-xs text-muted-foreground">New file · up to 50 MB</span>
                  {pendingVideoFile ? (
                    <span
                      className="mt-1 max-w-full truncate px-1 text-[11px] text-muted-foreground"
                      title={pendingVideoFile.name}
                    >
                      {pendingVideoFile.name}
                    </span>
                  ) : null}
                </button>
              ) : null}

              {recipe.videoUrl ? (
                <button
                  type="button"
                  onClick={() => !savingVideo && setDeleteVideoConfirmOpen(true)}
                  disabled={savingVideo}
                  className={cn(
                    'recipe-modal-tile group flex min-h-[8.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/[0.04] p-5 text-center shadow-sm transition',
                    'hover:border-destructive/35 hover:bg-destructive/[0.07] hover:shadow-md',
                    'outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0',
                    'disabled:pointer-events-none disabled:opacity-50',
                    'sm:mx-auto sm:max-w-sm'
                  )}
                >
                  <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive transition group-hover:bg-destructive/15">
                    <Trash2 className="size-5" aria-hidden />
                  </div>
                  <span className="text-sm font-medium tracking-tight text-foreground">Remove</span>
                  <span className="text-xs text-muted-foreground">Unlink from recipe</span>
                </button>
              ) : null}
            </div>
          </div>

          {pendingVideoFile && !recipe.videoUrl ? (
            <div className="flex w-full justify-center border-0 bg-muted/50 p-4">
              <button
                type="button"
                onClick={handleSubmitVideoUpload}
                disabled={savingVideo || !pendingVideoFile}
                className="icon-hit text-primary disabled:pointer-events-none disabled:opacity-40"
                aria-label="Confirm upload"
              >
                {savingVideo ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Check className="size-5" />
                )}
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteVideoConfirmOpen}
        onOpenChange={(open) => !open && !savingVideo && setDeleteVideoConfirmOpen(false)}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton>
          <div className="border-b border-border bg-muted/40 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive shadow-sm">
                <Trash2 className="size-6" aria-hidden />
              </div>
              <DialogHeader className="flex flex-1 flex-col justify-center space-y-0 text-left">
                <DialogTitle className="text-left leading-snug">Remove video?</DialogTitle>
              </DialogHeader>
            </div>
          </div>

          <div className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => !savingVideo && setDeleteVideoConfirmOpen(false)}
                disabled={savingVideo}
                className={cn(
                  'recipe-modal-tile group flex min-h-[8.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-muted/20 p-5 text-center shadow-sm transition',
                  'hover:border-primary/30 hover:bg-muted/35 hover:shadow-md',
                  'outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0',
                  'disabled:pointer-events-none disabled:opacity-50'
                )}
              >
                <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary/15">
                  <ArrowLeft className="size-5" aria-hidden />
                </div>
                <span className="text-sm font-medium tracking-tight text-foreground">Go back</span>
                <span className="text-xs text-muted-foreground">Keep current video</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!savingVideo) void handleConfirmDeleteVideo();
                }}
                disabled={savingVideo}
                className={cn(
                  'recipe-modal-tile group flex min-h-[8.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/[0.04] p-5 text-center shadow-sm transition',
                  'hover:border-destructive/35 hover:bg-destructive/[0.07] hover:shadow-md',
                  'outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0',
                  'disabled:pointer-events-none disabled:opacity-50'
                )}
              >
                <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive transition group-hover:bg-destructive/15">
                  {savingVideo ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-5" aria-hidden />
                  )}
                </div>
                <span className="text-sm font-medium tracking-tight text-foreground">Delete</span>
                <span className="text-xs text-muted-foreground">Unlink from recipe</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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