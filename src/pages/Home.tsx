import { useState, useEffect, useRef } from 'react';
import RecipeCard from '../components/RecipeCard';
import RecipeImport from '../components/RecipeImport';
import { getRecipes } from '../services/recipeService';
import { Recipe } from '../types/recipe';
import { FaSpinner, FaPlus, FaTimes, FaCheck, FaExclamationTriangle, FaUtensils, FaFilter, FaTags, FaChevronDown, FaChevronUp } from 'react-icons/fa';

const Home = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  
  const fetchRecipes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getRecipes();
      setRecipes(data);
      setFilteredRecipes(data);
      
      // Extract all unique tags
      const allTags = data.flatMap(recipe => recipe.tags || []);
      const uniqueTags = [...new Set(allTags)].sort();
      setAvailableTags(uniqueTags);
    } catch (err) {
      setError('Failed to fetch recipes. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRecipeImported = () => {
    // Show success notification
    setImportSuccess(true);
    // Hide import form
    setShowImport(false);
    // Fetch updated recipes
    fetchRecipes();
    
    // Hide success notification after 3 seconds
    setTimeout(() => {
      setImportSuccess(false);
    }, 3000);
  };
  
  // Filter recipes when selected tags change
  useEffect(() => {
    if (selectedTags.length === 0) {
      setFilteredRecipes(recipes);
    } else {
      const filtered = recipes.filter(recipe => 
        selectedTags.every(tag => recipe.tags?.includes(tag))
      );
      setFilteredRecipes(filtered);
    }
  }, [selectedTags, recipes]);
  
  useEffect(() => {
    fetchRecipes();
  }, []);
  
  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Toggle tag selection
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };
  
  return (
    <div>
      {importSuccess && (
        <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-md flex items-center">
          <FaCheck className="mr-2" />
          Recipe imported successfully!
        </div>
      )}
      
      {/* Recipe Import - Collapsible */}
      <div className="mb-8">
        {showImport ? (
          <div className="relative">
            <button 
              onClick={() => setShowImport(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              aria-label="Close import form"
            >
              <FaTimes size={20} />
            </button>
            <RecipeImport onRecipeImported={handleRecipeImported} />
          </div>
        ) : (
          <button
            onClick={() => setShowImport(true)}
            className="btn btn-primary flex items-center justify-center w-full md:w-auto mx-auto">
            <FaPlus className="mr-2" />
            Import New Recipe
          </button>
        )}
      </div>
      
      {/* Recipes Section */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Your Recipes</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{filteredRecipes.length} of {recipes.length} recipes</span>
          <div className="relative" ref={filterRef}>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center text-sm px-3 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              title="Filter recipes"
            >
              <FaFilter className="mr-1.5" />
              Filter
              {showFilters ? <FaChevronUp className="ml-1.5" size={12} /> : <FaChevronDown className="ml-1.5" size={12} />}
            </button>
            
            {/* Dropdown Filter Menu */}
            {showFilters && availableTags.length > 0 && (
              <div className="absolute right-0 mt-1 w-64 bg-white rounded-md shadow-lg z-10 py-2 px-3">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <h3 className="font-medium text-sm flex items-center">
                    <FaTags className="mr-1.5 text-gray-500" />
                    Filter by Tags
                  </h3>
                  {selectedTags.length > 0 && (
                    <button 
                      onClick={() => setSelectedTags([])} 
                      className="text-xs text-gray-500 hover:text-primary"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                
                {/* Cuisine tags */}
                <div className="mb-3">
                  <h4 className="text-xs font-medium mb-1.5 text-gray-500">Cuisine</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags
                      .filter(tag => [
                        'Italian', 'Mexican', 'Chinese', 'Indian', 'Japanese', 'Thai', 
                        'Mediterranean', 'French', 'Greek', 'Spanish', 'Korean', 'Vietnamese',
                        'American', 'Middle Eastern', 'Caribbean', 'African'
                      ].includes(tag))
                      .map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-2 py-0.5 text-xs rounded-full ${selectedTags.includes(tag) 
                            ? 'bg-primary text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          {tag}
                        </button>
                      ))}
                  </div>
                </div>
                
                {/* Dietary tags */}
                <div className="mb-3">
                  <h4 className="text-xs font-medium mb-1.5 text-gray-500">Dietary</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags
                      .filter(tag => [
                        'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 
                        'Low-Carb', 'Paleo', 'Pescatarian', 'Nut-Free', 'Egg-Free'
                      ].includes(tag))
                      .map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-2 py-0.5 text-xs rounded-full ${selectedTags.includes(tag) 
                            ? 'bg-primary text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          {tag}
                        </button>
                      ))}
                  </div>
                </div>
                
                {/* Meal type tags */}
                <div className="mb-3">
                  <h4 className="text-xs font-medium mb-1.5 text-gray-500">Meal Type</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags
                      .filter(tag => [
                        'Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Appetizer', 
                        'Side Dish', 'Soup', 'Salad', 'Drink', 'Baking'
                      ].includes(tag))
                      .map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-2 py-0.5 text-xs rounded-full ${selectedTags.includes(tag) 
                            ? 'bg-primary text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          {tag}
                        </button>
                      ))}
                  </div>
                </div>
                
                {/* Other tags */}
                <div>
                  <h4 className="text-xs font-medium mb-1.5 text-gray-500">Other Tags</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags
                      .filter(tag => ![
                        'Italian', 'Mexican', 'Chinese', 'Indian', 'Japanese', 'Thai', 
                        'Mediterranean', 'French', 'Greek', 'Spanish', 'Korean', 'Vietnamese',
                        'American', 'Middle Eastern', 'Caribbean', 'African',
                        'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 
                        'Low-Carb', 'Paleo', 'Pescatarian', 'Nut-Free', 'Egg-Free',
                        'Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Appetizer', 
                        'Side Dish', 'Soup', 'Salad', 'Drink', 'Baking'
                      ].includes(tag))
                      .map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-2 py-0.5 text-xs rounded-full ${selectedTags.includes(tag) 
                            ? 'bg-primary text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          {tag}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <FaSpinner className="animate-spin text-primary text-2xl" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-center">
          <FaExclamationTriangle className="mr-2" />
          {error}
        </div>
      ) : recipes.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-md text-center">
          <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <FaUtensils className="text-gray-400 text-2xl" />
          </div>
          <p className="text-gray-600 mb-2 font-medium">You don't have any recipes yet.</p>
          <p className="text-gray-500 mb-4">
            Import your first recipe to get started.
          </p>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-md text-center">
          <p className="text-gray-600 mb-2 font-medium">No recipes match your selected filters.</p>
          <button
            onClick={() => setSelectedTags([])}
            className="btn btn-secondary inline-flex items-center mt-2"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;