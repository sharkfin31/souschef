import { useEffect, useRef, type ReactNode } from 'react';
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
  { id: 'link', label: 'Link', icon: <LinkIcon className="size-4 shrink-0" /> },
  { id: 'image', label: 'Images', icon: <ImageIcon className="size-4 shrink-0" /> },
  { id: 'pdf', label: 'PDF', icon: <FileText className="size-4 shrink-0" /> },
  { id: 'text', label: 'Text', icon: <PenLine className="size-4 shrink-0" /> },
];

export function ImportRecipeFab({ open, onOpenChange, onSelectMethod, visible }: ImportRecipeFabProps) {
  const rootRef = useRef<HTMLDivElement>(null);

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

  if (!visible) return null;

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-hidden
          className="fixed inset-0 z-40 cursor-default bg-black/20 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
      ) : null}

      <div ref={rootRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {open ? (
          <div
            className="flex max-w-[calc(100vw-2rem)] flex-row flex-wrap justify-end gap-2"
            role="menu"
            aria-label="Import options"
          >
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelectMethod(m.id);
                  onOpenChange(false);
                }}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-5 py-2 text-sm font-medium text-foreground shadow-sm',
                  'origin-center transition-transform duration-200 ease-out hover:scale-105',
                  'hover:border-primary/40 hover:bg-primary hover:text-primary-foreground',
                  'focus-visible:outline-none focus-visible:ring-0 active:scale-100'
                )}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
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
          <Plus className={cn('size-7 transition-transform duration-200', open && 'rotate-45')} />
        </Button>
      </div>
    </>
  );
}
