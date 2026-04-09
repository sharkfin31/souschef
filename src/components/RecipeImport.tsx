import { useState, useEffect, useCallback, type FormEvent, type DragEvent } from 'react';
import {
  Image as ImageIcon,
  FileText,
  Loader2,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import { Recipe } from '../types/recipe';
import {
  extractRecipeFromUrl,
  extractRecipeFromMultipleImages,
  extractRecipeFromPDF,
  extractRecipeFromText,
} from '../services/api/recipeApi';
import { useNotification } from '../context/NotificationContext';
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
      addNotification('warning', 'Please enter a URL');
      return;
    }
    setLoading(true);
    try {
      const recipe = await extractRecipeFromUrl(url);
      finishImport(recipe, 'Recipe imported successfully!');
    } catch (err) {
      console.error(err);
      addNotification('error', err instanceof Error ? err.message : 'Failed to import recipe');
    } finally {
      setLoading(false);
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
      addNotification('warning', 'Please select at least one image');
      return;
    }
    setLoading(true);
    try {
      const recipe = await extractRecipeFromMultipleImages(images);
      finishImport(recipe, 'Recipe imported from image(s) successfully!');
    } catch (err) {
      console.error(err);
      addNotification(
        'error',
        err instanceof Error ? err.message : 'Failed to import recipe from image(s)'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      addNotification('error', 'Please select a PDF file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      addNotification('error', 'PDF file must be smaller than 10MB');
      return;
    }
    setPdfFile(file);
  };

  const handlePdfSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      addNotification('warning', 'Please select a PDF file');
      return;
    }
    setLoading(true);
    try {
      const recipe = await extractRecipeFromPDF(pdfFile);
      finishImport(recipe, 'Recipe imported from PDF successfully!');
    } catch (err) {
      console.error(err);
      addNotification('error', err instanceof Error ? err.message : 'Failed to import recipe from PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!recipeText.trim()) {
      addNotification('warning', 'Please enter recipe text');
      return;
    }
    setLoading(true);
    try {
      const recipe = await extractRecipeFromText(recipeText);
      finishImport(recipe, 'Recipe imported from text successfully!');
    } catch (err) {
      console.error(err);
      addNotification(
        'error',
        err instanceof Error ? err.message : 'Failed to import recipe from text'
      );
    } finally {
      setLoading(false);
    }
  };

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
