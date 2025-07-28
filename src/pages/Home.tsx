import { useState, useEffect, useRef } from 'react';
import { getRecipes } from '../services/recipe/recipeService';
import { useAuth } from '../context/AuthContext';
import { Recipe } from '../types/recipe';
import RecipeCard from '../components/RecipeCard';
import RecipeImport from '../components/RecipeImport';
import { FaFilter, FaSearch, FaTimes, FaPlus, FaChevronUp, FaChevronDown, FaTags, FaSpinner, FaUtensils } from 'react-icons/fa';
import { useNotification } from '../context/NotificationContext';

const Home = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'cookTime'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const filterRef = useRef<HTMLDivElement>(null);
  
  const fetchRecipes = async () => {
    setLoading(true);
    
    try {
      const data = await getRecipes();
      setRecipes(data);
      setFilteredRecipes(data);
      
      // Extract all unique tags
      const allTags = data.flatMap(recipe => recipe.tags || []);
      const uniqueTags = [...new Set(allTags)].sort();
      setAvailableTags(uniqueTags);
    } catch (err) {
      addNotification('error', 'Failed to fetch recipes. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRecipeImported = () => {
    // Hide import form
    setShowImport(false);
    // Fetch updated recipes
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
    
    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(recipe => 
        selectedTags.every(tag => recipe.tags?.includes(tag))
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
  }, [searchQuery, selectedTags, sortBy, sortOrder, recipes]);
  
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

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedTags([]);
    setSearchQuery('');
  };

  // Check if any filters are active
  const hasActiveFilters = selectedTags.length > 0 || searchQuery.trim();
  
  return (
    <div>
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
        ) : user ? (
          <button
            onClick={() => setShowImport(true)}
            className="btn btn-primary flex items-center justify-center w-full md:w-auto mx-auto">
            <FaPlus className="mr-2" />
            Import New Recipe
          </button>
        ) : (
          <div className="text-center">
            <p className="text-gray-600 mb-4">Please log in to import recipes</p>
          </div>
        )}
      </div>
      
      {/* Search and Filter Section */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search recipes by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FaTimes />
            </button>
          )}
        </div>
      </div>

      {/* Recipes Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
        <h2 className="text-xl font-semibold">Your Recipes</h2>
        <div className="flex items-center gap-4">
          {/* Results count and active filters summary */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-600">
            <span>{filteredRecipes.length} of {recipes.length} recipes</span>
            {hasActiveFilters && (
              <span className="text-primary">
                • {selectedTags.length > 0 && `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}`}
                {selectedTags.length > 0 && searchQuery && ', '}
                {searchQuery && 'search'}
              </span>
            )}
          </div>
          
          {/* Sort dropdown */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-') as ['name' | 'date' | 'cookTime', 'asc' | 'desc'];
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="cookTime-asc">Quick to cook</option>
            <option value="cookTime-desc">Long to cook</option>
          </select>
          
          {/* Advanced filter toggle */}
          <div className="relative" ref={filterRef}>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center text-sm px-3 py-1.5 border rounded-md transition-colors ${
                selectedTags.length > 0 
                  ? 'border-primary bg-primary text-white' 
                  : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}
              title="Advanced filters"
            >
              <FaFilter className="mr-1.5" />
              Tags
              {selectedTags.length > 0 && (
                <span className="ml-1 bg-white text-primary rounded-full px-1.5 py-0.5 text-xs font-medium">
                  {selectedTags.length}
                </span>
              )}
              {showFilters ? <FaChevronUp className="ml-1.5" size={12} /> : <FaChevronDown className="ml-1.5" size={12} />}
            </button>
            
            {/* Advanced Tag Filters Dropdown */}
            {showFilters && availableTags.length > 0 && (
              <div className="absolute right-0 mt-1 w-80 bg-white rounded-md shadow-lg z-10 py-3 px-4 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between border-b pb-2 mb-3">
                  <h3 className="font-medium text-sm flex items-center">
                    <FaTags className="mr-1.5 text-gray-500" />
                    Filter by Tags
                  </h3>
                  {selectedTags.length > 0 && (
                    <button 
                      onClick={() => setSelectedTags([])} 
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Clear tags
                    </button>
                  )}
                </div>
                
                {/* Cuisine tags */}
                {availableTags.some(tag => [
                  'Italian', 'Mexican', 'Chinese', 'Indian', 'Japanese', 'Thai', 
                  'Mediterranean', 'French', 'Greek', 'Spanish', 'Korean', 'Vietnamese',
                  'American', 'Middle Eastern', 'Caribbean', 'African'
                ].includes(tag)) && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium mb-2 text-gray-500 uppercase tracking-wide">Cuisine</h4>
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
                            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${selectedTags.includes(tag) 
                              ? 'bg-primary text-white shadow-sm' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            {tag}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
                
                {/* Dietary tags */}
                {availableTags.some(tag => [
                  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 
                  'Low-Carb', 'Paleo', 'Pescatarian', 'Nut-Free', 'Egg-Free'
                ].includes(tag)) && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium mb-2 text-gray-500 uppercase tracking-wide">Dietary</h4>
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
                            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${selectedTags.includes(tag) 
                              ? 'bg-primary text-white shadow-sm' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            {tag}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
                
                {/* Meal type tags */}
                {availableTags.some(tag => [
                  'Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Appetizer', 
                  'Side Dish', 'Soup', 'Salad', 'Drink', 'Baking'
                ].includes(tag)) && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium mb-2 text-gray-500 uppercase tracking-wide">Meal Type</h4>
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
                            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${selectedTags.includes(tag) 
                              ? 'bg-primary text-white shadow-sm' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            {tag}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
                
                {/* Other tags */}
                {availableTags.filter(tag => ![
                  'Italian', 'Mexican', 'Chinese', 'Indian', 'Japanese', 'Thai', 
                  'Mediterranean', 'French', 'Greek', 'Spanish', 'Korean', 'Vietnamese',
                  'American', 'Middle Eastern', 'Caribbean', 'African',
                  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 
                  'Low-Carb', 'Paleo', 'Pescatarian', 'Nut-Free', 'Egg-Free',
                  'Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Appetizer', 
                  'Side Dish', 'Soup', 'Salad', 'Drink', 'Baking'
                ].includes(tag)).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium mb-2 text-gray-500 uppercase tracking-wide">Other</h4>
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
                            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${selectedTags.includes(tag) 
                              ? 'bg-primary text-white shadow-sm' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            {tag}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <FaSpinner className="animate-spin text-primary text-2xl" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-md text-center">
          <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <FaUtensils className="text-gray-400 text-2xl" />
          </div>
          {user ? (
            <>
              <p className="text-gray-600 mb-2 font-medium">You don't have any recipes yet.</p>
              <p className="text-gray-500 mb-4">
                Import your first recipe to get started.
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