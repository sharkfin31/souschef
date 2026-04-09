import { Link } from 'react-router-dom';
import { Clock, List, Utensils } from 'lucide-react';
import { Recipe } from '../types/recipe';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RecipeCardProps {
  recipe: Recipe;
}

const tagPillClass =
  'inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground';

const RecipeCard = ({ recipe }: RecipeCardProps) => {
  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="group block h-full min-h-0 max-h-full p-1 outline-none focus-visible:outline-none focus-visible:ring-0"
    >
      <Card
        className={cn(
          'relative flex h-full min-h-0 max-h-full flex-col gap-0 overflow-visible rounded-2xl border border-border bg-card py-0',
          'shadow-sm ring-0 transition-shadow duration-200 hover:shadow-md'
        )}
      >
        <div
          className={cn(
            'flex min-h-[40%] shrink-0 flex-col justify-center overflow-hidden rounded-t-2xl border-b border-border/60 bg-gradient-to-br from-primary/10 via-muted/80 to-secondary/15 px-2.5 py-2'
          )}
        >
          <h3 className="line-clamp-3 text-center text-md font-semibold leading-snug text-card-foreground group-hover:text-primary">
            {recipe.title}
          </h3>
        </div>
        <CardContent className="flex min-h-[60%] flex-1 flex-col overflow-hidden rounded-b-2xl p-0">
          {recipe.description ? (
            <p className="line-clamp-3 px-4 pt-3 pb-2 text-xs leading-snug text-muted-foreground sm:text-sm">
              {recipe.description}
            </p>
          ) : null}

          {/* Footer: grows into remaining space; content pinned to bottom */}
          <div className="mt-auto flex flex-2 min-h-[40%] flex-col justify-end gap-2.5 border-t border-border px-4 pb-4 pt-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {recipe.cookTime ? (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0" />
                  <span>{recipe.cookTime} min</span>
                </div>
              ) : null}
              {recipe.servings ? (
                <div className="flex items-center gap-1.5">
                  <Utensils className="size-3.5 shrink-0" />
                  <span>{recipe.servings} servings</span>
                </div>
              ) : null}
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="flex min-h-6 flex-wrap gap-1.5">
                {recipe.tags && recipe.tags.length > 0 ? (
                  <>
                    {recipe.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className={tagPillClass}>
                        {tag}
                      </span>
                    ))}
                    {recipe.tags.length > 3 ? (
                      <span className={tagPillClass}>+{recipe.tags.length - 3}</span>
                    ) : null}
                  </>
                ) : null}
              </div>
              {recipe.ingredients ? (
                <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <List className="size-3.5" />
                  <span>{recipe.ingredients.length}</span>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default RecipeCard;
