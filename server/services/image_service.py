import uuid
import shutil
import sys
import os
import subprocess
import asyncio
from pathlib import Path
from typing import List, Dict, Any
from PIL import Image
import pytesseract
from fastapi import UploadFile, HTTPException, BackgroundTasks
from services.ai_service import process_with_ai
from services.db_service import save_recipe_to_db
from config import UPLOAD_DIR

def check_tesseract_installed() -> bool:
    """Check if Tesseract is installed and in PATH"""
    try:
        # On Render, assume Tesseract is installed via the build command
        if os.environ.get('RENDER') == 'true':
            return True
            
        # Check based on platform
        cmd = 'where' if sys.platform.startswith('win') else 'which'
        result = subprocess.run([cmd, 'tesseract'], capture_output=True, text=True)
        return result.returncode == 0
    except Exception as e:
        print(f"Error checking Tesseract installation: {e}")
        return False

async def extract_text_from_image(image_path: Path) -> str:
    """Extract text from an image using OCR"""
    try:
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img)
        print(f"OCR completed for {image_path.name}: {len(text)} characters")
        return text
    except Exception as e:
        print(f"Error extracting text from image: {e}")
        return ""

def cleanup_file(file_path: Path) -> None:
    """Delete a specific file after processing is complete"""
    try:
        if file_path.exists():
            file_path.unlink()
            print(f"Cleaned up file: {file_path}")
    except Exception as e:
        print(f"Failed to delete {file_path}: {e}")

def cleanup_files(file_paths: List[Path]) -> None:
    """Delete multiple files after processing is complete"""
    for file_path in file_paths:
        cleanup_file(file_path)

async def save_uploaded_image(image: UploadFile) -> tuple[Path, str]:
    """Save an uploaded image and return the file path and URL"""
    upload_dir = Path(UPLOAD_DIR)
    upload_dir.mkdir(exist_ok=True)
    file_extension = image.filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = upload_dir / unique_filename
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    
    # Small delay after saving to ensure file is written
    await asyncio.sleep(0.1)
    return file_path, f"/uploads/{unique_filename}"

async def process_and_save_recipe(text: str, source_info: str, image_url: str) -> Dict[str, Any]:
    """Process recipe text with AI and save to database"""
    recipe_data = await process_with_ai(text)
    
    if not recipe_data:
        raise HTTPException(status_code=500, detail="Failed to extract recipe from image(s)")
        
    recipe_id = await save_recipe_to_db(recipe_data, source_info, image_url)
    
    if not recipe_id:
        raise HTTPException(status_code=500, detail="Failed to save recipe to database")
    
    return {
        "success": True,
        "recipe_id": recipe_id,
        "title": recipe_data.get("title", "Untitled Recipe"),
        "ingredients": recipe_data.get("ingredients", []),
        "instructions": recipe_data.get("instructions", []),
        "image_url": image_url
    }



async def process_multiple_recipe_images(images: List[UploadFile], background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Process one or more recipe images and extract recipe data"""
    if not check_tesseract_installed():
        raise HTTPException(status_code=500, detail="Tesseract is not installed or it's not in your PATH.")
    
    if not images or len(images) == 0:
        raise HTTPException(status_code=400, detail="No images provided")
    
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
            
        result = await process_and_save_recipe(combined_text, source_info, primary_image_url)
        
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