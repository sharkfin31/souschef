import { Link } from 'react-router-dom';
import { ShoppingBasket, User } from 'lucide-react';
import { TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '../context/AuthContext';
import { cn } from '@/lib/utils';

const Navbar = () => {
  const { user, loading } = useAuth();

  return (
    <nav className="border-b border-border bg-card shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-90"
          >
            <img src="/favicon.svg" alt="souschef Logo" className="h-8 w-8" />
            <span className="text-xl font-bold tracking-tight">souschef</span>
          </Link>
          {!loading && user ? (
            <div className="flex items-center gap-4 sm:gap-2">
              <TooltipTrigger label="Grocery lists">
                <Link
                  to="/grocery-list"
                  className="icon-hit text-foreground"
                  aria-label="Grocery lists"
                >
                  <ShoppingBasket className="size-5" />
                </Link>
              </TooltipTrigger>

              <TooltipTrigger label="Profile">
                <Link to="/profile" aria-label="Profile" className={cn('icon-hit text-foreground')}>
                  <User className="size-5" />
                </Link>
              </TooltipTrigger>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
