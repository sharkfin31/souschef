"""
Image Service - OCR-based recipe extraction from uploaded images

This service handles image upload, validation, OCR processing, and 
AI-powered recipe extraction from image content.
"""

import uuid
import shutil
import sys
import os
import subprocess
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from PIL import Image
import pytesseract
from fastapi import UploadFile, HTTPException, BackgroundTasks

# Local imports
from services.ai_service import process_with_ai
from services.db_service import save_recipe_to_db
from config import UPLOAD_DIR
from utils.constants import FileConfig, OCRConfig, Messages, StatusCodes
from utils.helpers import setup_logger

# Setup logging
logger = setup_logger(__name__)

def check_tesseract_installed() -> bool:
    """Check if Tesseract is installed and accessible"""
    try:
        # Try to run tesseract version command
        result = subprocess.run(['tesseract', '--version'], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            version_info = result.stdout.strip()
            logger.info(f"Tesseract found: {version_info.split()[1] if version_info else 'unknown version'}")
            return True
        else:
            logger.error(f"Tesseract command failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("Tesseract command timed out")
        return False
    except FileNotFoundError:
        logger.error("Tesseract executable not found in PATH")
        return False
    except Exception as e:
        logger.error(f"Error checking Tesseract installation: {e}")
        return False

def validate_image_file(image: UploadFile) -> bool:
    """Validate uploaded image file against size and format constraints"""
    # Check file extension
    if not image.filename:
        logger.warning("Image file has no filename")
        logger.warning("Image file has no filename")
        return False
        
    file_ext = Path(image.filename).suffix.lower()
    if file_ext not in FileConfig.ALLOWED_IMAGE_EXTENSIONS:
        logger.warning(f"Unsupported file extension: {file_ext}")
        return False
    
    # Check file size (reset position after checking)
    image.file.seek(0, 2)  # Seek to end
    file_size = image.file.tell()
    image.file.seek(0)  # Reset to beginning
    
    if file_size > FileConfig.MAX_IMAGE_SIZE:
        logger.warning(f"File too large: {file_size} bytes (max: {FileConfig.MAX_IMAGE_SIZE})")
        return False
    
    return True

async def extract_text_from_image(image_path: Path) -> str:
    """Extract text from an image using OCR with comprehensive error handling"""
    try:
        # Verify file exists and is readable
        if not image_path.exists():
            logger.error(f"Image file not found: {image_path}")
            return ""
        
        # Open and process image
        with Image.open(image_path) as img:
            # Convert to RGB if necessary (for PNG with transparency, etc.)
            # Convert to RGB if necessary for better OCR results
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            # Extract text with optimized configuration
            text = pytesseract.image_to_string(img, config=OCRConfig.CONFIG)
            
            logger.info(f"OCR completed for {image_path.name}: {len(text)} characters extracted")
            return text.strip()
        
    except Exception as e:
        logger.error(f"Error extracting text from {image_path}: {e}")
        return ""

def cleanup_file(file_path: Path) -> None:
    """Safely delete a file after processing"""
    try:
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Cleaned up file: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to delete {file_path}: {e}")
def cleanup_files(file_paths: List[Path]) -> None:
    """Delete multiple files after processing"""
    for file_path in file_paths:
        cleanup_file(file_path)


async def save_uploaded_image(image: UploadFile) -> Tuple[Path, str]:
    """Save uploaded image with validation and return file path and URL"""
    try:
        # Validate image
        if not validate_image_file(image):
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Create upload directory
        upload_dir = Path(UPLOAD_DIR)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(image.filename).suffix.lower()
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        
        # Verify file was saved correctly
        if not file_path.exists() or file_path.stat().st_size == 0:
            raise HTTPException(status_code=500, detail="Failed to save image file")
        
        # Small delay to ensure file system operations complete
        await asyncio.sleep(0.1)
        
        image_url = f"/uploads/{unique_filename}"
        logger.info(f"Saved image: {unique_filename} ({file_path.stat().st_size} bytes)")
        
        return file_path, image_url
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving uploaded image: {e}")
        raise HTTPException(status_code=500, detail="Failed to save image")


async def process_and_save_recipe(text: str, source_info: str, image_url: str, image_count: int = 1, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Process recipe text with AI and save to database"""
    try:
        if not text.strip():
            raise HTTPException(status_code=400, detail="No text extracted from image(s)")
        
        logger.info(f"Processing recipe text ({len(text)} characters) with AI...")
        recipe_data = await process_with_ai(text)
        
        if not recipe_data:
            raise HTTPException(status_code=500, detail="AI failed to extract recipe information")
        
        logger.info(f"AI extracted recipe: {recipe_data.get('title', 'Unknown')}")
        
        # Save to database with user association
        recipe_id = await save_recipe_to_db(recipe_data, source_info, image_url, user_id)
        
        if not recipe_id:
            raise HTTPException(status_code=500, detail="Failed to save recipe to database")
        
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
            "image_url": image_url,
            "image_count": image_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing recipe: {e}")
        raise HTTPException(status_code=500, detail="Failed to process recipe")


async def process_multiple_recipe_images(images: List[UploadFile], background_tasks: BackgroundTasks = None, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Process one or more recipe images and extract structured recipe data"""
    
    # Validate Tesseract installation
    if not check_tesseract_installed():
        raise HTTPException(
            status_code=500, 
            detail="OCR service unavailable. Tesseract is not installed or accessible."
        )
    
    # Validate input
    if not images or len(images) == 0:
        raise HTTPException(status_code=400, detail="No images provided")
    
    if len(images) > 10:  # Reasonable limit
        raise HTTPException(status_code=400, detail="Too many images. Maximum 10 images allowed.")
    
    saved_files: List[Path] = []
    combined_text = ""
    primary_image_url: Optional[str] = None
    
    try:
        logger.info(f"Processing {len(images)} image(s) for recipe extraction...")
        
        # Process images efficiently
        if len(images) == 1:
            # Single image optimization
            file_path, image_url = await save_uploaded_image(images[0])
            saved_files.append(file_path)
            combined_text = await extract_text_from_image(file_path)
            primary_image_url = image_url
            
        else:
            # Multiple images with proper ordering context
            image_texts = []
            
            for i, image in enumerate(images):
                # Rate limiting between images
                if i > 0:
                    await asyncio.sleep(0.3)
                
                logger.info(f"Processing image {i+1}/{len(images)}: {image.filename}")
                
                # Save and process image
                file_path, image_url = await save_uploaded_image(image)
                saved_files.append(file_path)
                
                # Extract text
                extracted_text = await extract_text_from_image(file_path)
                
                if extracted_text:
                    image_texts.append(f"--- Image {i+1} ---\n{extracted_text}")
                
                # Use first image as primary
                if i == 0:
                    primary_image_url = image_url
            
            # Combine all text with proper context
            if image_texts:
                combined_text = (
                    "IMPORTANT: The following content comes from multiple images in order. "
                    "Process them sequentially - ingredients may be in early images, "
                    "instructions in later images.\n\n" + 
                    "\n\n".join(image_texts)
                )
        
        # Validate extracted text
        if not combined_text.strip():
            raise HTTPException(
                status_code=400, 
                detail="No readable text found in the provided image(s). Please ensure images are clear and contain recipe text."
            )
        
        logger.info(f"Total extracted text: {len(combined_text)} characters")
        
        # Process with AI after brief delay
        await asyncio.sleep(0.5)
        
        # Generate source info
        source_info = (
            f"Image upload: {images[0].filename}" if len(images) == 1 
            else f"Multiple image upload: {len(images)} images"
        )
        
        # Process and save recipe
        result = await process_and_save_recipe(
            combined_text, 
            source_info, 
            primary_image_url or "", 
            len(images),
            user_id
        )
        
        # Schedule cleanup
        if saved_files:
            background_tasks.add_task(cleanup_files, saved_files)
        
        return result
        
    except HTTPException:
        # Clean up on known errors
        cleanup_files(saved_files)
        raise
        
    except Exception as e:
        # Clean up on unexpected errors
        cleanup_files(saved_files)
        logger.error(f"Unexpected error processing images: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred during image processing")
    
    saved_files = []
    combined_text = ""
    primary_image_url = None
    
    try:
        # Handle single image case more efficiently
        if len(images) == 1:
            file_path, image_url = await save_uploaded_image(images[0])
            saved_files.append(file_path)
            combined_text = await extract_text_from_image(file_path)
            primary_image_url = image_url
        else:
            # Process multiple images in order
            for i, image in enumerate(images):
                # Add delay between processing images
                if i > 0:
                    await asyncio.sleep(0.3)
                    
                # Save the image
                file_path, image_url = await save_uploaded_image(image)
                saved_files.append(file_path)
                
                # Extract text from the image
                extracted_text = await extract_text_from_image(file_path)
                combined_text += f"\n\n--- Image {i+1} (Order is important) ---\n{extracted_text}"
                
                # Use the first image as the primary image
                if i == 0:
                    primary_image_url = image_url
                    
            # Add a note about image order for the AI
            combined_text = "IMPORTANT: Images are provided in sequential order. Process them in this order.\n\n" + combined_text
        
        # Add delay before AI processing to ensure all OCR is complete
        await asyncio.sleep(0.5)
        
        # Process and save the recipe
        source_info = f"Image upload: {images[0].filename}" if len(images) == 1 \
            else f"Multiple image upload: {len(images)} images"
            
        result = await process_and_save_recipe(combined_text, source_info, primary_image_url, len(images), user_id)
        
        # Schedule cleanup after processing is complete
        if saved_files:
            background_tasks.add_task(cleanup_files, saved_files)
        
        # Add image count to the result
        result["image_count"] = len(images)
        return result
    
    except Exception as e:
        # Clean up the files in case of error
        for file_path in saved_files:
            if file_path.exists():
                file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=str(e))