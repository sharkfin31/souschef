import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export function TooltipTrigger({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tooltipRef.current;
    if (!trigger || !tip) return;

    const tr = trigger.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const pad = 8;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const placeAbove = () => tr.top - gap - tipRect.height;
    const placeBelow = () => tr.bottom + gap;

    let top = placeAbove();
    const fitsAbove = top >= pad;
    const fitsBelow = placeBelow() + tipRect.height <= vh - pad;

    if (!fitsAbove && fitsBelow) {
      top = placeBelow();
    } else if (!fitsAbove && !fitsBelow) {
      top = Math.max(pad, Math.min(placeAbove(), vh - pad - tipRect.height));
    } else if (fitsAbove && !fitsBelow && tr.top < vh - tr.bottom) {
      top = placeBelow();
    }

    if (top + tipRect.height > vh - pad) {
      top = Math.max(pad, vh - pad - tipRect.height);
    }

    let left = tr.left + tr.width / 2 - tipRect.width / 2;
    left = Math.max(pad, Math.min(left, vw - tipRect.width - pad));

    setCoords({ top, left });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updatePosition();
        const tip = tooltipRef.current;
        resizeObserverRef.current?.disconnect();
        if (tip) {
          resizeObserverRef.current = new ResizeObserver(() => updatePosition());
          resizeObserverRef.current.observe(tip);
        }
      });
    });
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      cancelAnimationFrame(id);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, label, updatePosition]);

  const tooltip =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              zIndex: 9999,
              opacity: coords ? 1 : 0,
              pointerEvents: 'none',
            }}
            className={cn(
              'w-max max-w-[min(18rem,calc(100vw-1rem))] rounded-md bg-foreground px-2.5 py-1.5 text-center text-xs font-medium text-background shadow-md'
            )}
          >
            {label}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={cn('inline-flex', className)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}
