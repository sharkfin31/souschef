import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export type RecipeVideoEmbedProps = {
  src: string;
  /** Optional poster (e.g. recipe hero image) while the first frame loads */
  poster?: string | null;
  className?: string;
};

/**
 * Lazy-loads the video element when near the viewport to avoid heavy downloads on scroll-past.
 */
export function RecipeVideoEmbed({ src, poster, className }: RecipeVideoEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setActive(true);
      },
      { rootMargin: '180px', threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={
        className ??
        'relative mb-6 aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted'
      }
    >
      {active ? (
        <video
          className="h-full w-full object-contain bg-black/5"
          controls
          playsInline
          preload="metadata"
          poster={poster ?? undefined}
          src={src}
          aria-label="Recipe video"
        />
      ) : (
        <div className="flex h-full min-h-[12rem] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}
    </div>
  );
}
