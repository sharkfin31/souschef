import { useState } from 'react';
import { FaSpinner, FaLink, FaImage, FaArrowUp, FaArrowDown, FaFilePdf } from 'react-icons/fa';
import { FaPen } from 'react-icons/fa6';
import { Recipe } from '../types/recipe';
import { extractRecipeFromUrl, extractRecipeFromMultipleImages, extractRecipeFromPDF, extractRecipeFromText } from '../services/api/recipeApi';
import { useNotification } from '../context/NotificationContext';

interface RecipeImportProps {
  onRecipeImported: (recipe: Recipe) => void;
}

const RecipeImport = ({ onRecipeImported }: RecipeImportProps) => {
  const { addNotification } = useNotification();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'image' | 'pdf' | 'text'>('link');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [recipeText, setRecipeText] = useState('');


  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      addNotification('warning', 'Please enter a URL');
      return;
    }
    
    setLoading(true);
    
    try {
      const recipe = await extractRecipeFromUrl(url);
      
      addNotification('success', 'Recipe imported successfully!');
      onRecipeImported(recipe);
      
      // Reset form after a delay
      setTimeout(() => {
        setUrl('');
      }, 1000);
      
    } catch (err) {
      console.error(err);
      addNotification('error', err instanceof Error ? err.message : 'Failed to import recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newImages = [...images];
    const newPreviews = [...imagePreviews];
    
    // Process each selected file
    Array.from(files).forEach(file => {
      // Add file to images array
      newImages.push(file);
      
      // Create preview for the file
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result as string);
        setImagePreviews([...newPreviews]);
      };
      reader.readAsDataURL(file);
    });
    
    setImages(newImages);
  };
  
  const moveImage = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === images.length - 1)
    ) {
      return; // Can't move further in this direction
    }
    
    const newImages = [...images];
    const newPreviews = [...imagePreviews];
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap images
    [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
    [newPreviews[index], newPreviews[newIndex]] = [newPreviews[newIndex], newPreviews[index]];
    
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (images.length === 0) {
      addNotification('warning', 'Please select at least one image');
      return;
    }
    
    setLoading(true);
    
    try {
      // Use the same endpoint for both single and multiple images
      const recipe = await extractRecipeFromMultipleImages(images);
      
      addNotification('success', 'Recipe imported from image(s) successfully!');
      onRecipeImported(recipe);
      
      // Reset form after a delay
      setTimeout(() => {
        setImages([]);
        setImagePreviews([]);
      }, 1000);
      
    } catch (err) {
      console.error(err);
      addNotification('error', err instanceof Error ? err.message : 'Failed to import recipe from image(s)');
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (file.type !== 'application/pdf') {
      addNotification('error', 'Please select a PDF file');
      return;
    }
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      addNotification('error', 'PDF file must be smaller than 10MB');
      return;
    }
    
    setPdfFile(file);
  };

  const handlePdfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pdfFile) {
      addNotification('warning', 'Please select a PDF file');
      return;
    }
    
    setLoading(true);
    
    try {
      const recipe = await extractRecipeFromPDF(pdfFile);
      
      addNotification('success', 'Recipe imported from PDF successfully!');
      onRecipeImported(recipe);
      
      // Reset form after a delay
      setTimeout(() => {
        setPdfFile(null);
        // Reset file input
        const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }, 1000);
      
    } catch (err) {
      console.error(err);
      addNotification('error', err instanceof Error ? err.message : 'Failed to import recipe from PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipeText.trim()) {
      addNotification('warning', 'Please enter recipe text');
      return;
    }
    
    setLoading(true);
    
    try {
      const recipe = await extractRecipeFromText(recipeText);
      
      addNotification('success', 'Recipe imported from text successfully!');
      onRecipeImported(recipe);
      
      // Reset form after a delay
      setTimeout(() => {
        setRecipeText('');
      }, 1000);
      
    } catch (err) {
      console.error(err);
      addNotification('error', err instanceof Error ? err.message : 'Failed to import recipe from text');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Import a Recipe</h2>
      
      {/* Tab Navigation */}
      <div className="flex border-b mb-4">
        <button
          className={`py-2 px-4 ${activeTab === 'link' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
          onClick={() => setActiveTab('link')}
        >
          <FaLink className="inline mr-2" />
          From Link
        </button>
        <button
          className={`py-2 px-4 ${activeTab === 'image' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
          onClick={() => setActiveTab('image')}
        >
          <FaImage className="inline mr-2" />
          From Image
        </button>
        <button
          className={`py-2 px-4 ${activeTab === 'pdf' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
          onClick={() => setActiveTab('pdf')}
        >
          <FaFilePdf className="inline mr-2" />
          From PDF
        </button>
        <button
          className={`py-2 px-4 ${activeTab === 'text' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
          onClick={() => setActiveTab('text')}
        >
          <FaPen className="inline mr-2" />
          From Text
        </button>
      </div>
      
      {/* Link Import Form */}
      {activeTab === 'link' && (
        <form onSubmit={handleLinkSubmit} className="space-y-4">
          <div>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste recipe URL (Instagram, Food Network, AllRecipes, etc.)"
              className="input w-full"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Supports Instagram posts, recipe websites, and blogs with recipe content
            </p>
          </div>
          
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" />
                Importing Recipe...
              </span>
            ) : (
              'Import'
            )}
          </button>
        </form>
      )}
      
      {/* Image Import Form */}
      {activeTab === 'image' && (
        <form onSubmit={handleImageSubmit} className="space-y-4">
          <div>
            <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
              Recipe Images
            </label>
            {imagePreviews.length > 1 && (
              <p className="text-xs text-gray-500 mb-2">
                Images will be processed in the order shown. Use the arrows to reorder if needed.
              </p>
            )}
            
            {imagePreviews.length > 0 ? (
              <div className="mb-2">
                <div className="grid grid-cols-2 gap-2">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <div className="absolute top-2 left-2 bg-white rounded-md px-2 py-1 shadow-md text-xs font-medium">
                        {index + 1}
                      </div>
                      <img 
                        src={preview} 
                        alt={`Recipe preview ${index + 1}`} 
                        className="w-full h-32 object-cover rounded-md"
                      />
                      <div className="absolute top-2 right-2 flex flex-col bg-white rounded-md shadow-md">
                        <button
                          type="button"
                          onClick={() => moveImage(index, 'up')}
                          disabled={index === 0}
                          className={`p-1 ${index === 0 ? 'text-gray-300' : 'hover:text-primary'}`}
                          title="Move up"
                        >
                          <FaArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(index, 'down')}
                          disabled={index === images.length - 1}
                          className={`p-1 ${index === images.length - 1 ? 'text-gray-300' : 'hover:text-primary'}`}
                          title="Move down"
                        >
                          <FaArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = [...images];
                            const newPreviews = [...imagePreviews];
                            newImages.splice(index, 1);
                            newPreviews.splice(index, 1);
                            setImages(newImages);
                            setImagePreviews(newPreviews);
                          }}
                          className="p-1 hover:text-red-500"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-center">
                  <button 
                    type="button" 
                    className="text-primary text-sm"
                    onClick={() => document.getElementById('image-upload')?.click()}
                  >
                    + Add more images
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:border-primary"
                onClick={() => document.getElementById('image-upload')?.click()}
              >
                <FaImage className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-1 text-sm text-gray-500">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </p>
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
          
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading || images.length === 0}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" />
                Processing Image...
              </span>
            ) : (
              'Extract Recipe from Image'
            )}
          </button>
        </form>
      )}
      
      {/* PDF Import Form */}
      {activeTab === 'pdf' && (
        <form onSubmit={handlePdfSubmit} className="space-y-4">
          <div>
            <label htmlFor="pdf" className="block text-sm font-medium text-gray-700 mb-1">
              Recipe PDF File
            </label>
            
            {pdfFile ? (
              <div className="mb-2">
                <div className="flex items-center p-3 bg-gray-50 rounded-md border">
                  <FaFilePdf className="text-red-500 mr-3" size={24} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{pdfFile.name}</div>
                    <div className="text-xs text-gray-500">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPdfFile(null);
                      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
                      if (fileInput) fileInput.value = '';
                    }}
                    className="text-red-500 hover:text-red-700 ml-2"
                    title="Remove PDF"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 text-center">
                  <button 
                    type="button" 
                    className="text-primary text-sm"
                    onClick={() => document.getElementById('pdf-upload')?.click()}
                  >
                    Choose different PDF
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:border-primary"
                onClick={() => document.getElementById('pdf-upload')?.click()}
              >
                <FaFilePdf className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-1 text-sm text-gray-500">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500">
                  PDF files up to 10MB
                </p>
              </div>
            )}
            
            <input
              type="file"
              id="pdf-upload"
              accept=".pdf,application/pdf"
              onChange={handlePdfUpload}
              className="hidden"
            />
            
            <p className="mt-1 text-xs text-gray-500">
              Supports text-based PDFs and scanned PDFs with OCR processing
            </p>
          </div>
          
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading || !pdfFile}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" />
                Processing PDF...
              </span>
            ) : (
              'Extract Recipe from PDF'
            )}
          </button>
        </form>
      )}
      
      {/* Text Import Form */}
      {activeTab === 'text' && (
        <form onSubmit={handleTextSubmit} className="space-y-4">
          <div>
            <label htmlFor="recipe-text" className="block text-sm font-medium text-gray-700 mb-1">
              Recipe Text
            </label>
            <textarea
              id="recipe-text"
              value={recipeText}
              onChange={(e) => setRecipeText(e.target.value)}
              placeholder="Paste your recipe text here... Include ingredients, instructions, cooking times, and any other details you have."
              className="input w-full min-h-[200px] resize-y"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              AI will automatically extract ingredients, instructions, cooking times, and other recipe details from your text
            </p>
          </div>
          
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading || !recipeText.trim()}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" />
                Processing Text...
              </span>
            ) : (
              'Extract Recipe from Text'
            )}
          </button>
        </form>
      )}
    </div>
  );
};

export default RecipeImport;