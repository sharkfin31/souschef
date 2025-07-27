"""
PDF Service - Extract recipes from PDF files

This service handles PDF recipe extraction using:
- PyPDF2 for text-based PDFs
- pdf2image + Tesseract OCR for scanned/image-based PDFs
- AI processing for recipe data extraction
"""

import io
import os
import tempfile
from typing import Dict, Any, Optional
from fastapi import UploadFile, BackgroundTasks

# PDF processing imports
try:
    import PyPDF2
    from pdf2image import convert_from_bytes
    import pytesseract
    from PIL import Image
    PDF_DEPENDENCIES_AVAILABLE = True
except ImportError:
    PDF_DEPENDENCIES_AVAILABLE = False

from services.ai_service import process_with_ai
from services.db_service import save_recipe_to_db
from utils.helpers import setup_logger

# Setup logging
logger = setup_logger(__name__)

async def process_recipe_pdf(pdf_file: UploadFile, background_tasks: BackgroundTasks = None, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Process a PDF file to extract recipe information
    
    Args:
        pdf_file: Uploaded PDF file
        background_tasks: FastAPI background tasks
        user_id: Optional user ID for database association
        
    Returns:
        Dict containing extracted recipe data or error information
    """
    if not PDF_DEPENDENCIES_AVAILABLE:
        return {
            "error": "PDF processing not available",
            "message": "Required PDF processing libraries are not installed. Please install: PyPDF2, pdf2image, pytesseract",
            "suggestion": "Install with: pip install PyPDF2 pdf2image pytesseract"
        }
    
    try:
        logger.info(f"Starting PDF processing for file: {pdf_file.filename}")
        
        # Read PDF file content
        pdf_content = await pdf_file.read()
        
        # Try text extraction first (faster for text-based PDFs)
        extracted_text = await extract_text_from_pdf(pdf_content)
        
        # If text extraction yields poor results, try OCR
        if not extracted_text or len(extracted_text.strip()) < 50:
            logger.info("Text extraction yielded minimal content, attempting OCR")
            extracted_text = await extract_text_via_ocr(pdf_content)
        
        if not extracted_text or not extracted_text.strip():
            return {
                "error": "No text found in PDF",
                "message": "The PDF file doesn't contain any readable text or images with text.",
                "suggestion": "Ensure the PDF contains recipe content and is not corrupted."
            }
        
        logger.info(f"Extracted {len(extracted_text)} characters from PDF")
        
        # Process extracted text with AI
        recipe_data = await process_with_ai(extracted_text)
        if not recipe_data:
            return {
                "error": "Failed to extract recipe information",
                "message": "The AI couldn't identify recipe content in the PDF.",
                "suggestion": "Ensure the PDF contains clear recipe instructions and ingredients.",
                "raw_text": extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text
            }
        
        # Save to database
        source_info = f"PDF: {pdf_file.filename}"
        recipe_id = await save_recipe_to_db(recipe_data, source_info, None, user_id)
        
        if not recipe_id:
            return {
                "error": "Failed to save recipe",
                "message": "The recipe was extracted but couldn't be saved to the database."
            }
        
        logger.info(f"Successfully extracted and saved recipe from PDF: {recipe_data.get('title', 'Untitled')}")
        
        # Return successful result
        return {
            "success": True,
            "recipe_id": recipe_id,
            "title": recipe_data.get("title", "Untitled Recipe"),
            "description": recipe_data.get("description", ""),
            "prep_time": recipe_data.get("prepTime"),
            "cook_time": recipe_data.get("cookTime"),
            "total_time": recipe_data.get("totalTime"),
            "servings": recipe_data.get("servings"),
            "difficulty": recipe_data.get("difficulty"),
            "ingredients": recipe_data.get("ingredients", []),
            "instructions": recipe_data.get("instructions", []),
            "tags": recipe_data.get("tags", []),
            "source": "pdf",
            "extracted_via": "pdf_processor",
            "file_info": {
                "filename": pdf_file.filename,
                "size_bytes": len(pdf_content),
                "extraction_method": "text" if len(extracted_text) > 50 else "ocr"
            }
        }
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Unexpected error processing PDF: {error_msg}")
        
        return {
            "error": "PDF processing failed",
            "message": f"An unexpected error occurred: {error_msg}",
            "suggestion": "Try again with a different PDF file or use the image upload feature."
        }

async def extract_text_from_pdf(pdf_content: bytes) -> str:
    """
    Extract text from PDF using PyPDF2
    
    Args:
        pdf_content: PDF file content as bytes
        
    Returns:
        Extracted text string
    """
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        text = ""
        
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text += page.extract_text() + "\n"
        
        return text.strip()
        
    except Exception as e:
        logger.warning(f"Text extraction failed: {e}")
        return ""

async def extract_text_via_ocr(pdf_content: bytes) -> str:
    """
    Extract text from PDF using OCR (for scanned PDFs)
    
    Args:
        pdf_content: PDF file content as bytes
        
    Returns:
        Extracted text string via OCR
    """
    try:
        # Convert PDF pages to images
        images = convert_from_bytes(pdf_content, dpi=150)
        
        extracted_text = ""
        for i, image in enumerate(images):
            logger.info(f"Processing page {i+1} with OCR")
            
            # Use Tesseract to extract text from image
            page_text = pytesseract.image_to_string(image, lang='eng')
            extracted_text += f"Page {i+1}:\n{page_text}\n\n"
        
        return extracted_text.strip()
        
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        return ""

def validate_pdf_dependencies():
    """
    Check if all required PDF processing dependencies are available
    
    Returns:
        Dict with dependency status information
    """
    dependencies = {
        "PyPDF2": False,
        "pdf2image": False,
        "pytesseract": False,
        "PIL": False
    }
    
    try:
        import PyPDF2
        dependencies["PyPDF2"] = True
    except ImportError:
        pass
    
    try:
        from pdf2image import convert_from_bytes
        dependencies["pdf2image"] = True
    except ImportError:
        pass
    
    try:
        import pytesseract
        dependencies["pytesseract"] = True
    except ImportError:
        pass
    
    try:
        from PIL import Image
        dependencies["PIL"] = True
    except ImportError:
        pass
    
    all_available = all(dependencies.values())
    
    return {
        "all_available": all_available,
        "dependencies": dependencies,
        "missing": [dep for dep, available in dependencies.items() if not available],
        "install_command": "pip install PyPDF2 pdf2image pytesseract Pillow" if not all_available else None
    }

async def get_pdf_service_status() -> Dict[str, Any]:
    """
    Get the current PDF service status and capabilities
    
    Returns:
        Dict with service status information
    """
    dependency_status = validate_pdf_dependencies()
    
    return {
        "service_available": dependency_status["all_available"],
        "capabilities": {
            "text_extraction": dependency_status["dependencies"]["PyPDF2"],
            "ocr_extraction": dependency_status["dependencies"]["pdf2image"] and dependency_status["dependencies"]["pytesseract"],
            "image_processing": dependency_status["dependencies"]["PIL"]
        },
        "supported_formats": ["PDF"] if dependency_status["all_available"] else [],
        "dependencies": dependency_status,
        "notes": "PDF service supports both text-based and scanned PDFs" if dependency_status["all_available"] else "PDF dependencies not installed"
    }

# Helper function to test PDF processing
async def test_pdf_processing(pdf_path: str) -> Dict[str, Any]:
    """Test PDF processing with a specific file"""
    if not os.path.exists(pdf_path):
        return {"error": f"File not found: {pdf_path}"}
    
    try:
        with open(pdf_path, 'rb') as f:
            pdf_content = f.read()
        
        # Create a mock UploadFile
        class MockUploadFile:
            def __init__(self, content, filename):
                self.content = content
                self.filename = filename
                self.content_type = "application/pdf"
            
            async def read(self):
                return self.content
        
        mock_file = MockUploadFile(pdf_content, os.path.basename(pdf_path))
        result = await process_recipe_pdf(mock_file)
        
        return result
        
    except Exception as e:
        return {"error": f"Test failed: {e}"}
