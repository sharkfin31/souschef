import { Link } from 'react-router-dom';
import { Recipe } from '../types/recipe';
import { FaClock, FaUtensils, FaList } from 'react-icons/fa';

interface RecipeCardProps {
  recipe: Recipe;
}

const RecipeCard = ({ recipe }: RecipeCardProps) => {
  return (
    <Link 
      to={`/recipe/${recipe.id}`} 
      className="card h-full flex flex-col hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="relative h-24 overflow-hidden bg-gray-100 flex items-center justify-center">
        <div className="text-lg font-medium">{recipe.title}</div>
      </div>
      <div className="p-4 flex-grow flex flex-col relative">
        {recipe.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">{recipe.description}</p>
        )}
        <div className="mt-auto pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {recipe.cookTime ? (
              <div className="flex items-center">
                <FaClock className="mr-1" />
                <span>{recipe.cookTime} min</span>
              </div>
            ) : null}
            {recipe.servings ? (
              <div className="flex items-center">
                <FaUtensils className="mr-1" />
                <span>{recipe.servings} servings</span>
              </div>
            ) : null}
          </div>
          <div className="mt-2 flex justify-between items-center">
            <div className="flex flex-wrap gap-1 min-h-[24px]">
              {recipe.tags && recipe.tags.length > 0 && (
                <>
                  {recipe.tags.slice(0, 3).map((tag, index) => (
                    <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                  {recipe.tags.length > 3 && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      +{recipe.tags.length - 3}
                    </span>
                  )}
                </>
              )}
            </div>
            {recipe.ingredients && (
              <div className="flex items-center text-xs text-gray-500">
                <FaList className="mr-1" />
                <span>{recipe.ingredients.length} ingredients</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default RecipeCard;