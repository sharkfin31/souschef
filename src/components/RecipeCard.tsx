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
    <Link to={`/recipe/${recipe.id}`} className="group block h-full outline-none">
      <Card
        className={cn(
          'flex h-full flex-col overflow-hidden border border-border shadow-sm ring-0',
          'transition-shadow hover:shadow-md'
        )}
      >
        <div
          className={cn(
            'flex min-h-[5rem] items-center justify-center border-b border-border/60 bg-gradient-to-br from-primary/10 via-muted/80 to-secondary/15 px-4 py-3'
          )}
        >
          <h3 className="line-clamp-3 text-base font-semibold leading-snug text-card-foreground group-hover:text-primary">
            {recipe.title}
          </h3>
        </div>
        <CardContent className="flex flex-1 flex-col p-0">
          {recipe.description ? (
            <p className="line-clamp-3 shrink-0 px-4 pt-4 pb-6 text-sm leading-relaxed text-muted-foreground">
              {recipe.description}
            </p>
          ) : null}

          <div className="mt-auto flex flex-col gap-2 border-t border-border px-4 pb-3 pt-6">
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
