import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Navbar from './Navbar';

/** Home and grocery list: lock to viewport height and prevent page scroll (content scrolls inside panes). */
function useViewportLockedMain() {
  const { pathname } = useLocation();
  return pathname === '/' || pathname === '/grocery-list';
}

const Layout = () => {
  const viewportLocked = useViewportLockedMain();

  return (
    <div
      className={cn(
        'flex flex-col bg-background',
        viewportLocked ? 'h-dvh max-h-dvh min-h-0 overflow-hidden' : 'min-h-screen'
      )}
    >
      <Navbar className="shrink-0" />
      <main
        className={cn(
          'container mx-auto w-full text-sm leading-relaxed text-foreground',
          viewportLocked
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4'
            : 'flex-grow px-4 py-8'
        )}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
