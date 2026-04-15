import { useState, useEffect, useCallback, type FormEvent, type DragEvent } from 'react';
import {
  Image as ImageIcon,
  FileText,
  Loader2,
  ArrowUp,
  ArrowDown,
  X,
  Check,
} from 'lucide-react';
import { Recipe } from '../types/recipe';
import {
  extractRecipeFromUrl,
  extractRecipeFromMultipleImages,
  extractRecipeFromPDF,
  extractRecipeFromText,
  type ImportJobSnapshot,
} from '../services/api/recipeApi';
import { mergeStageTrail, type StageTrailEntry } from '@/lib/importProgressUi';
import { useNotification } from '../context/NotificationContext';
import { getImportFlowErrorParts } from '@/lib/importFlowErrors';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type ImportMethod = 'link' | 'image' | 'pdf' | 'text';

const METHOD_COPY: Record<ImportMethod, { title: string; description: string }> = {
  link: {
    title: 'Import from link',
    description: '',
  },
  image: {
    title: 'Import from images',
    description: 'Add one or more photos of the recipe.',
  },
  pdf: {
    title: 'Import from PDF',
    description: '',
  },
  text: {
    title: 'Import from text',
    description: '',
  },
};

interface RecipeImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecipeImported: (recipe: Recipe) => void;
  /** Required when opening: set from the + menu on the home page. */
  initialMethod?: ImportMethod | null;
}

const RecipeImport = ({
  open,
  onOpenChange,
  onRecipeImported,
  initialMethod = null,
}: RecipeImportProps) => {
  const { addNotification } = useNotification();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    label: string;
    percent: number;
    stage: string;
    status: ImportJobSnapshot['status'];
  } | null>(null);
  const [stageTrail, setStageTrail] = useState<StageTrailEntry[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [recipeText, setRecipeText] = useState('');

  const resetForms = useCallback(() => {
    setUrl('');
    setImages([]);
    setImagePreviews([]);
    setPdfFile(null);
    setRecipeText('');
    setLoading(false);
    setImportProgress(null);
    setStageTrail([]);
  }, []);

  const trackJobProgress = useCallback((job: ImportJobSnapshot) => {
    setImportProgress({
      label: job.stage_label,
      percent: job.percent,
      stage: job.stage,
      status: job.status,
    });
    setStageTrail((prev) => mergeStageTrail(prev, job));
  }, []);

  useEffect(() => {
    if (open) {
      resetForms();
    }
  }, [open, initialMethod, resetForms]);

  /** Method comes only from the + menu; there is no in-dialog method switch. */
  const method = open ? initialMethod ?? null : null;

  useEffect(() => {
    if (open && !initialMethod) {
      onOpenChange(false);
    }
  }, [open, initialMethod, onOpenChange]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetForms();
    }
    onOpenChange(next);
  };

  const finishImport = (recipe: Recipe, successMessage: string) => {
    addNotification('success', successMessage);
    onRecipeImported(recipe);
    resetForms();
    handleOpenChange(false);
  };

  const handleLinkSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      addNotification('warning', 'Link import: URL missing', {
        description: 'Paste a full recipe page URL, then tap Import.',
      });
      return;
    }
    setLoading(true);
    setStageTrail([{ stage: 'starting', label: 'Starting import…' }]);
    setImportProgress({
      label: 'Starting import…',
      percent: 0,
      stage: 'starting',
      status: 'pending',
    });
    try {
      const recipe = await extractRecipeFromUrl(url, trackJobProgress);
      finishImport(recipe, 'Recipe imported successfully!');
    } catch (err) {
      console.error(err);
      const { title, description } = getImportFlowErrorParts(err, 'link');
      addNotification('error', title, { description });
    } finally {
      setLoading(false);
      setImportProgress(null);
    }
  };

  const addImageFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const newImages = [...images];
    const newPreviews = [...imagePreviews];
    Array.from(files).forEach((file) => {
      newImages.push(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result as string);
        setImagePreviews([...newPreviews]);
      };
      reader.readAsDataURL(file);
    });
    setImages(newImages);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    addImageFiles(e.target.files);
  };

  const onImageDrop = (e: DragEvent) => {
    e.preventDefault();
    addImageFiles(e.dataTransfer.files);
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === images.length - 1)
    ) {
      return;
    }
    const newImages = [...images];
    const newPreviews = [...imagePreviews];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
    [newPreviews[index], newPreviews[newIndex]] = [newPreviews[newIndex], newPreviews[index]];
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const handleImageSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (images.length === 0) {
      addNotification('warning', 'Image import: no photos', {
        description: 'Add one or more recipe photos (camera roll or drag-and-drop), then Import.',
      });
      return;
    }
    setLoading(true);
    setStageTrail([{ stage: 'starting', label: 'Starting import…' }]);
    setImportProgress({
      label: 'Starting import…',
      percent: 0,
      stage: 'starting',
      status: 'pending',
    });
    try {
      const recipe = await extractRecipeFromMultipleImages(images, trackJobProgress);
      finishImport(recipe, 'Recipe imported from image(s) successfully!');
    } catch (err) {
      console.error(err);
      const { title, description } = getImportFlowErrorParts(err, 'image');
      addNotification('error', title, { description });
    } finally {
      setLoading(false);
      setImportProgress(null);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      addNotification('error', 'PDF import: wrong file type', {
        description: 'Choose a file ending in .pdf (application/pdf).',
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      addNotification('error', 'PDF import: file too large', {
        description: 'Maximum size is 10 MB. Compress the PDF or split it and try again.',
      });
      return;
    }
    setPdfFile(file);
  };

  const handlePdfSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      addNotification('warning', 'PDF import: no file', {
        description: 'Tap the upload area and choose a PDF before importing.',
      });
      return;
    }
    setLoading(true);
    setStageTrail([{ stage: 'starting', label: 'Starting import…' }]);
    setImportProgress({
      label: 'Starting import…',
      percent: 0,
      stage: 'starting',
      status: 'pending',
    });
    try {
      const recipe = await extractRecipeFromPDF(pdfFile, trackJobProgress);
      finishImport(recipe, 'Recipe imported from PDF successfully!');
    } catch (err) {
      console.error(err);
      const { title, description } = getImportFlowErrorParts(err, 'pdf');
      addNotification('error', title, { description });
    } finally {
      setLoading(false);
      setImportProgress(null);
    }
  };

  const handleTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!recipeText.trim()) {
      addNotification('warning', 'Text import: empty', {
        description: 'Paste ingredients, steps, and times into the box, then Import.',
      });
      return;
    }
    setLoading(true);
    setStageTrail([{ stage: 'starting', label: 'Starting import…' }]);
    setImportProgress({
      label: 'Starting import…',
      percent: 0,
      stage: 'starting',
      status: 'pending',
    });
    try {
      const recipe = await extractRecipeFromText(recipeText, trackJobProgress);
      finishImport(recipe, 'Recipe imported from text successfully!');
    } catch (err) {
      console.error(err);
      const { title, description } = getImportFlowErrorParts(err, 'text');
      addNotification('error', title, { description });
    } finally {
      setLoading(false);
      setImportProgress(null);
    }
  };

  const progressPct = importProgress?.percent ?? 0;
  const liveStatusLabel =
    importProgress?.status === 'pending'
      ? 'Queued on server'
      : importProgress?.status === 'running'
        ? 'Running on server'
        : importProgress?.status === 'completed'
          ? 'Finishing up'
          : '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
        className={cn(
          'import-dialog-popup max-h-[min(88vh,640px)] gap-0 overflow-y-auto p-5 sm:max-w-md'
        )}
        showCloseButton={!loading}
      >
        {method ? (
          <>
            <DialogHeader className="space-y-0.5 pb-3 text-center sm:text-left">
              <DialogTitle className="text-lg">{METHOD_COPY[method].title}</DialogTitle>
              <DialogDescription className="text-xs">{METHOD_COPY[method].description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-1">
            {loading ? (
              <div
                className="rounded-lg border border-border bg-muted/30 px-3 py-3"
                role="status"
                aria-live="polite"
                aria-atomic="false"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Live updates
                    </span>
                    {liveStatusLabel ? (
                      <span className="truncate text-[10px] text-muted-foreground/90">· {liveStatusLabel}</span>
                    ) : null}
                  </div>
                  <span className="shrink-0 tabular-nums text-xs font-semibold text-foreground">
                    {Math.round(progressPct)}%
                  </span>
                </div>

                {stageTrail.length > 0 ? (
                  <ol className="mb-3 max-h-32 space-y-1.5 overflow-y-auto border-b border-border/50 pb-3">
                    {stageTrail.map((entry, i) => {
                      const isLast = i === stageTrail.length - 1;
                      return (
                        <li
                          key={`${entry.stage}-${i}`}
                          className={cn(
                            'flex items-start gap-2 text-[11px] leading-snug',
                            isLast ? 'font-medium text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {isLast ? (
                            <Loader2
                              className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary"
                              aria-hidden
                            />
                          ) : (
                            <Check
                              className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-500"
                              aria-hidden
                            />
                          )}
                          <span className="min-w-0">{entry.label}</span>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}
            {method === 'link' && (
              <form onSubmit={handleLinkSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="import-url">Recipe URL</Label>
                  <Input
                    id="import-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    'Import'
                  )}
                </Button>
              </form>
            )}

            {method === 'image' && (
              <form onSubmit={handleImageSubmit} className="space-y-4">
                <div className="space-y-2">
                  {imagePreviews.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Images are processed in order. Use arrows to reorder.
                    </p>
                  )}
                  {imagePreviews.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {imagePreviews.map((preview, index) => (
                          <div key={index} className="relative">
                            <div className="absolute top-2 left-2 rounded-md bg-card px-2 py-1 text-xs font-medium shadow">
                              {index + 1}
                            </div>
                            <img
                              src={preview}
                              alt={`Recipe preview ${index + 1}`}
                              className="h-32 w-full rounded-md object-cover"
                            />
                            <div className="absolute top-2 right-2 flex flex-col rounded-md bg-card shadow">
                              <button
                                type="button"
                                onClick={() => moveImage(index, 'up')}
                                disabled={index === 0}
                                className={cn(
                                  'p-1',
                                  index === 0 ? 'text-muted-foreground/40' : 'hover:text-primary'
                                )}
                                title="Move up"
                              >
                                <ArrowUp className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveImage(index, 'down')}
                                disabled={index === images.length - 1}
                                className={cn(
                                  'p-1',
                                  index === images.length - 1
                                    ? 'text-muted-foreground/40'
                                    : 'hover:text-primary'
                                )}
                                title="Move down"
                              >
                                <ArrowDown className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const ni = [...images];
                                  const np = [...imagePreviews];
                                  ni.splice(index, 1);
                                  np.splice(index, 1);
                                  setImages(ni);
                                  setImagePreviews(np);
                                }}
                                className="p-1 hover:text-destructive"
                                title="Remove"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-center">
                        <button
                          type="button"
                          className="text-sm text-primary hover:underline"
                          onClick={() => document.getElementById('image-upload')?.click()}
                        >
                          + Add more images
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          document.getElementById('image-upload')?.click();
                        }
                      }}
                      className="cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center hover:border-primary/50"
                      onClick={() => document.getElementById('image-upload')?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={onImageDrop}
                    >
                      <ImageIcon className="mx-auto size-12 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Click or drop images here
                      </p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    id="image-upload"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    multiple
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || images.length === 0}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    'Import'
                  )}
                </Button>
              </form>
            )}

            {method === 'pdf' && (
              <form onSubmit={handlePdfSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pdf">PDF file</Label>
                  {pdfFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center rounded-lg border bg-muted/40 p-3">
                        <FileText className="mr-3 size-8 shrink-0 text-red-500" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{pdfFile.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPdfFile(null);
                            const el = document.getElementById('pdf-upload') as HTMLInputElement;
                            if (el) el.value = '';
                          }}
                          className="text-destructive hover:text-destructive/80"
                          title="Remove PDF"
                        >
                          <X className="size-5" />
                        </button>
                      </div>
                      <div className="text-center">
                        <button
                          type="button"
                          className="text-sm text-primary hover:underline"
                          onClick={() => document.getElementById('pdf-upload')?.click()}
                        >
                          Choose different PDF
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center hover:border-primary/50"
                      onClick={() => document.getElementById('pdf-upload')?.click()}
                    >
                      <FileText className="mx-auto size-12 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">Click to upload a PDF</p>
                      <p className="text-xs text-muted-foreground">Up to 10MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    id="pdf-upload"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !pdfFile}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    'Import'
                  )}
                </Button>
              </form>
            )}

            {method === 'text' && (
              <form onSubmit={handleTextSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    id="recipe-text"
                    value={recipeText}
                    onChange={(e) => setRecipeText(e.target.value)}
                    placeholder="Paste your recipe… ingredients, steps, times, and notes."
                    className="min-h-[200px] resize-y"
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !recipeText.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    'Import'
                  )}
                </Button>
              </form>
            )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default RecipeImport;
