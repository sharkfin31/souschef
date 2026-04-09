import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  PenLine,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ImportMethod } from './RecipeImport';

interface ImportRecipeFabProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMethod: (method: ImportMethod) => void;
  /** When false, FAB is hidden (e.g. logged out). */
  visible: boolean;
}

const METHODS: { id: ImportMethod; label: string; icon: ReactNode }[] = [
  { id: 'link', label: 'Import from link', icon: <LinkIcon className="size-[1.25rem]" strokeWidth={1.75} /> },
  { id: 'image', label: 'Import from images', icon: <ImageIcon className="size-[1.25rem]" strokeWidth={1.75} /> },
  { id: 'pdf', label: 'Import from PDF', icon: <FileText className="size-[1.25rem]" strokeWidth={1.75} /> },
  { id: 'text', label: 'Import from text', icon: <PenLine className="size-[1.25rem]" strokeWidth={1.75} /> },
];

/** Long enough for staggered vertical exit (delay + animation). */
const EXIT_MS = 420;

/** Fixed circle size; default page background; icon picks up muted → primary on hover. */
const IMPORT_OPTION_CIRCLE =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm';

export function ImportRecipeFab({ open, onOpenChange, onSelectMethod, visible }: ImportRecipeFabProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuExiting, setMenuExiting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setMenuMounted(true);
      setMenuExiting(false);
      return;
    }
    if (!menuMounted) return;
    setMenuExiting(true);
    const t = window.setTimeout(() => {
      setMenuMounted(false);
      setMenuExiting(false);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open, menuMounted]);

  if (!visible) return null;

  const showBackdrop = open || menuMounted;

  return (
    <>
      {showBackdrop ? (
        <button
          type="button"
          aria-hidden
          className={cn(
            'fixed inset-0 z-40 cursor-default bg-black/20 backdrop-blur-sm transition-opacity duration-200',
            menuMounted ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => onOpenChange(false)}
        />
      ) : null}

      <div ref={rootRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
        {menuMounted ? (
          <div
            className="flex max-h-[calc(100vh-2rem)] flex-col justify-center gap-2"
            role="menu"
            aria-label="Import options"
          >
            {METHODS.map((m, index) => {
              const staggerIn = (METHODS.length - 1 - index) * 52;
              const staggerOut = index * 44;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="menuitem"
                  aria-label={m.label}
                  title={m.label}
                  style={{
                    animationDelay: menuExiting ? `${staggerOut}ms` : `${staggerIn}ms`,
                  }}
                  onClick={() => {
                    onSelectMethod(m.id);
                    onOpenChange(false);
                  }}
                  className={cn(
                    IMPORT_OPTION_CIRCLE,
                    'origin-center',
                    'hover:border-primary/40 hover:bg-background hover:text-primary',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    'active:scale-[0.96]',
                    menuExiting ? 'import-bubble-exit' : 'import-bubble-enter'
                  )}
                >
                  {m.icon}
                </button>
              );
            })}
          </div>
        ) : null}

        <Button
          type="button"
          size="icon-lg"
          className="size-14 shrink-0 rounded-full shadow-lg"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={open ? 'Close import options' : 'Import recipe'}
        >
          <Plus className={cn('size-7 transition-transform duration-200', open && 'rotate-45')} strokeWidth={1.75} />
        </Button>
      </div>
    </>
  );
}
