import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getRecipeById, updateRecipeTags, updateRecipeTitle, deleteRecipe } from '../services/recipe/recipeService';
import { getMasterGroceryList, addIngredientsToList } from '../services/grocery/groceryService';
import { Recipe } from '../types/recipe';
import { FaArrowLeft, FaClock, FaUtensils, FaSpinner, FaShoppingBasket, FaInstagram, FaImage, FaLink, FaMinus, FaPlus, FaTags, FaTrash } from 'react-icons/fa';
import { FaPen, FaCheck, FaXmark } from "react-icons/fa6"; 
import '../assets/list-animations.css';
import '../assets/grocery-animations.css';

const RecipeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [listCreated, setListCreated] = useState(false);
  const [servings, setServings] = useState(2);
  const [originalServings, setOriginalServings] = useState<number | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
  const [editingTags, setEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [updatingTags, setUpdatingTags] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [updatingTitle, setUpdatingTitle] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
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
      if (event.ctrlKey && event.key === 'Enter' && editingTags && !updatingTags) {
        handleSaveTags();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingTags, updatingTags]);
  
  useEffect(() => {
    const fetchRecipe = async () => {
      if (!id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = await getRecipeById(id);
        setRecipe(data);
        setNewTitle(data.title); // Initialize title editing state
        
        // Initialize servings from recipe if available, otherwise default to 2
        if (data.servings) {
          setServings(data.servings);
          setOriginalServings(data.servings);
        } else {
          setServings(2);
          setOriginalServings(2);
        }
      } catch (err) {
        setError('Failed to fetch recipe. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecipe();
  }, [id]);
  
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
  
  // Handle adding a new tag
  const handleAddTag = () => {
    if (!recipe || !newTag.trim()) return;
    
    // Check if we've reached the 5-tag limit
    if (recipe.tags.length >= 5) {
      setNewTag('');
      setError('Maximum of 5 tags allowed per recipe');
      setTimeout(() => setError(null), 3000); // Clear error after 3 seconds
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
  
  // Handle saving tags to the database
  const handleSaveTags = async () => {
    if (!recipe || !id) return;
    
    setUpdatingTags(true);
    try {
      await updateRecipeTags(id, recipe.tags);
      setEditingTags(false);
      setShowSuggestions(false);
    } catch (err) {
      setError('Failed to update tags. Please try again.');
      console.error(err);
    } finally {
      setUpdatingTags(false);
    }
  };
  
  // Handle canceling tag edits
  const handleCancelTagEdit = async () => {
    if (!id) return;
    
    // Reload the recipe to get the original tags
    try {
      const data = await getRecipeById(id);
      setRecipe(data);
      setEditingTags(false);
      setShowSuggestions(false);
    } catch (err) {
      console.error(err);
    }
  };
  
  // Handle saving the recipe title
  const handleSaveTitle = async () => {
    if (!recipe || !id || !newTitle.trim()) return;
    
    setUpdatingTitle(true);
    try {
      await updateRecipeTitle(id, newTitle.trim());
      setRecipe({
        ...recipe,
        title: newTitle.trim()
      });
      setEditingTitle(false);
    } catch (err) {
      setError('Failed to update recipe title. Please try again.');
      console.error(err);
    } finally {
      setUpdatingTitle(false);
    }
  };
  
  // Handle canceling title edits
  const handleCancelTitleEdit = () => {
    setNewTitle(recipe?.title || '');
    setEditingTitle(false);
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
      
      // Reset after 3 seconds
      setTimeout(() => {
        setListCreated(false);
      }, 3000);
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
        <FaSpinner className="animate-spin text-primary text-2xl" />
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
      <div className="mb-6 flex justify-between items-center">
        <Link to="/" className="flex items-center text-primary hover:underline">
          <FaArrowLeft className="mr-2" />
          Back to Recipes
        </Link>
        
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-md shadow-sm transition-colors"
          title="Delete recipe"
        >
          <FaTrash size={14} />
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">        
        <div className="p-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              {editingTitle ? (
                <div className="flex items-center">
                  <input
                    type="text"
                    ref={titleInputRef}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && !updatingTitle && handleSaveTitle()}
                    className="text-3xl font-bold border-b border-gray-300 focus:outline-none focus:border-primary mr-2"
                    disabled={updatingTitle}
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button 
                      onClick={handleSaveTitle}
                      className="text-primary hover:text-green-600 p-1"
                      disabled={updatingTitle || !newTitle.trim()}
                    >
                      {updatingTitle ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                    </button>
                    <button 
                      onClick={handleCancelTitleEdit}
                      className="text-gray-500 hover:text-red-500 p-1"
                      disabled={updatingTitle}
                    >
                      <FaXmark />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center">
                  <h1 className="text-3xl font-bold mr-2">{recipe.title}</h1>
                  <button 
                    onClick={() => {
                      setEditingTitle(true);
                      setNewTitle(recipe.title);
                      setTimeout(() => titleInputRef.current?.focus(), 0);
                    }}
                    className="text-gray-400 hover:text-primary mt-1 p-2"
                    title="Edit recipe title"
                  >
                    <FaPen />
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex items-center text-gray-700 bg-white px-3 py-2 rounded-md shadow-sm">
              <FaUtensils className="mr-2 text-primary" />
              <div className="flex items-center">
                <span className="mr-2">Servings:</span>
                <div className="flex items-center border rounded-md">
                  <button 
                    onClick={() => setServings(Math.max(1, servings - 1))}
                    className="px-2 py-1 text-primary hover:bg-gray-100"
                    aria-label="Decrease servings"
                  >
                    <FaMinus size={12} />
                  </button>
                  <span className="px-2 font-bold">{servings}</span>
                  <button 
                    onClick={() => setServings(servings + 1)}
                    className="px-2 py-1 text-primary hover:bg-gray-100"
                    aria-label="Increase servings"
                  >
                    <FaPlus size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {recipe.description && (
            <p className="text-gray-600 mb-4 text-sm italic">{recipe.description}</p>
          )}
          
          {(recipe.prepTime || recipe.cookTime) && (
            <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              {recipe.prepTime && (
                <div className="flex items-center text-gray-700 bg-white px-3 py-2 rounded-md shadow-sm">
                  <FaClock className="mr-2 text-primary" />
                  <span>Prep: <strong>{recipe.prepTime} min</strong></span>
                </div>
              )}
              
              {recipe.cookTime && (
                <div className="flex items-center text-gray-700 bg-white px-3 py-2 rounded-md shadow-sm">
                  <FaClock className="mr-2 text-primary" />
                  <span>Cook: <strong>{recipe.cookTime} min</strong></span>
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b border-gray-200">Ingredients</h2>
              <ul className="space-y-3 relative">
                {getSortedIngredients().map((ingredient, index) => {
                  const isSelected = selectedIngredients.has(ingredient.id || '');
                  return (
                    <li 
                      key={ingredient.id || index} 
                      className={`flex items-start bg-gray-50 p-2 rounded-md transition-all duration-200 ease-in-out ${isSelected ? 'opacity-70' : ''}`}
                    >
                      <button 
                        onClick={() => ingredient.id && toggleIngredient(ingredient.id)}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 transition-all duration-200 ease-in-out ${isSelected ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-300'}`}
                        aria-label={isSelected ? 'Mark as not used' : 'Mark as used'}
                      >
                        {isSelected && <FaCheck className="text-xs transition-opacity duration-200" />}
                      </button>
                      <span className={`transition-all duration-500 ${isSelected ? 'line-through text-gray-500' : ''}`}>
                        <span className="font-medium">{ingredient.name.charAt(0).toUpperCase() + ingredient.name.slice(1)}</span>{' '}
                        {ingredient.displayQuantity && <span className="text-gray-700">{ingredient.displayQuantity}</span>}{' '}
                        {ingredient.unit && <span className="text-gray-700">{ingredient.unit}</span>}
                        {ingredient.notes && (
                          <span className="text-gray-500 italic"> ({ingredient.notes})</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            <div className="md:col-span-2">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b border-gray-200">Instructions</h2>
              <ol className="space-y-4">
                {recipe.instructions.map((instruction, index) => (
                  <li key={index} className="flex">
                    <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mr-3">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{instruction.description.charAt(0).toUpperCase() + instruction.description.slice(1)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          
          {/* Tags */}
          <div className="mt-8 pt-4 border-t border-gray-200">
            <div className="mb-2">
              <div className="flex items-center mb-2">
                <div className="flex items-center flex-grow">
                  <FaTags className="mr-2 text-primary" />
                  <h3 className="font-medium mr-2">Tags:</h3>
                
                  {recipe.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 flex-grow relative">
                      {recipe.tags.map((tag, index) => (
                        <div 
                          key={index} 
                          className={`bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm flex items-center ${editingTags ? '' : 'cursor-default'}`}
                        >
                          {tag}
                          {editingTags && (
                            <button 
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-2 text-gray-500 hover:text-red-500"
                              disabled={updatingTags}
                            >
                              <FaXmark size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !editingTags && (
                      <span className="text-gray-500 text-sm italic mt-0.5">No tags added yet!</span>
                    )
                  )}
                </div>

                <div className="create-list-container inline-flex relative">
                  <button 
                    onClick={() => setEditingTags(true)}
                    className={`btn btn-primary flex items-center create-list-button ${editingTags ? 'hidden' : ''}`}
                    title="Edit tags"
                  >
                    <FaPen />
                  </button>
                  
                  <form onSubmit={(e) => { e.preventDefault(); handleAddTag(); }} className={`create-list-form ${editingTags ? 'visible' : ''} flex items-center relative`}>
                    <div className="relative">
                      <input
                        type="text"
                        ref={newTagInputRef}
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newTag.trim() && !updatingTags) {
                              handleAddTag();
                            }
                          }
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Add a new tag"
                        className="input mr-2 w-48"
                        disabled={updatingTags}
                        autoFocus={editingTags}
                      />
                    </div>
                    
                    <div className="flex space-x-1">
                      {newTag.trim() ? (
                        <button 
                          type="submit" 
                          className="text-primary hover:text-green-600 p-2"
                          disabled={updatingTags}
                        >
                          <FaCheck />
                        </button>
                      ) : null}
                      <button 
                        type="button" 
                        onClick={() => {
                          if (updatingTags) return;
                          handleSaveTags();
                        }}
                        className="text-primary hover:text-green-600 p-2"
                        disabled={updatingTags}
                        title="Save tags (Ctrl+Enter)"
                      >
                        {updatingTags ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setNewTag('');
                          handleCancelTagEdit();
                        }}
                        className="text-gray-500 hover:text-red-500 p-2"
                        disabled={updatingTags}
                      >
                        <FaXmark />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            
            {/* Tag suggestions as a row */}
            {showSuggestions && editingTags && (
              <div className="mt-3 p-2 bg-white">
                <div className="flex flex-wrap gap-1 items-center">
                  <p className="text-xs text-gray-500 mr-2">Suggestions:</p>
                  {tagSuggestions
                    .filter(tag => !recipe.tags.includes(tag))
                    .slice(0, 12)
                    .map((tag, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
            <p className="text-sm text-gray-500 flex items-center">
              Source:{' '}
              {recipe.sourceUrl && recipe.sourceUrl.trim() ? (
                <>
                  {recipe.sourceUrl.includes('instagram.com') ? (
                    <FaInstagram className="ml-2 mr-1 text-pink-500" />
                  ) : recipe.sourceUrl.startsWith('http') ? (
                    <FaLink className="ml-2 mr-1 text-blue-500" />
                  ) : (
                    <FaImage className="ml-2 mr-1 text-gray-500" />
                  )}
                  <a
                    href={
                      recipe.sourceUrl.startsWith('http') 
                        ? recipe.sourceUrl 
                        : recipe.sourceUrl.startsWith('www.') 
                          ? `https://${recipe.sourceUrl}`
                          : recipe.sourceUrl.includes('.') 
                            ? `https://${recipe.sourceUrl}`
                            : undefined
                    }
                    target={
                      recipe.sourceUrl.startsWith('http') || 
                      recipe.sourceUrl.startsWith('www.') || 
                      recipe.sourceUrl.includes('.') 
                        ? "_blank" 
                        : "_self"
                    }
                    rel={
                      recipe.sourceUrl.startsWith('http') || 
                      recipe.sourceUrl.startsWith('www.') || 
                      recipe.sourceUrl.includes('.') 
                        ? "noopener noreferrer" 
                        : undefined
                    }
                    className="text-primary hover:underline"
                    onClick={(e) => {
                      // If it's not a valid URL, prevent the default behavior
                      if (!recipe.sourceUrl.startsWith('http') && 
                          !recipe.sourceUrl.startsWith('www.') && 
                          !recipe.sourceUrl.includes('.')) {
                        e.preventDefault();
                      }
                    }}
                  >
                    {recipe.sourceUrl.includes('instagram.com')
                      ? 'Instagram Post'
                      : recipe.sourceUrl.startsWith('http')
                        ? new URL(recipe.sourceUrl).hostname
                        : recipe.sourceUrl.startsWith('www.')
                          ? recipe.sourceUrl
                          : recipe.sourceUrl.includes('.')
                            ? recipe.sourceUrl
                            : recipe.sourceUrl}
                  </a>
                </>
              ) : (
                <span className="ml-2 flex items-center">
                  <FaImage className="mr-1 text-gray-500" />
                  Imported from image
                </span>
              )}</p>
            
            <button
              onClick={handleCreateGroceryList}
              disabled={creatingList || listCreated}
              className={`btn ${
                listCreated ? 'bg-green-500 hover:bg-green-500' : 'btn-secondary'
              } flex items-center justify-center shadow-md transition-all transform hover:scale-105`}
            >
              {creatingList ? (
                <span className="flex items-center">
                  <FaSpinner className="animate-spin mr-2" />
                  Creating List...
                </span>
              ) : listCreated ? (
                <span className="flex items-center">
                  <FaCheck className="mr-2" />
                  Added to Grocery List
                </span>
              ) : (
                <span className="flex items-center">
                  <FaShoppingBasket className="mr-2" />
                  Add to Grocery List
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <FaTrash className="text-red-500 mr-3" size={24} />
                <h3 className="text-lg font-semibold">Delete Recipe</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete "<strong>{recipe?.title}</strong>"? 
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteRecipe}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 flex items-center"
                >
                  {deleting ? (
                    <>
                      <FaSpinner className="animate-spin mr-2" size={14} />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <FaTrash className="mr-2" size={14} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeDetail;