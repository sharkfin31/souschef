"""
Recipe Routes - API endpoints for recipe extraction and management

This module handles all recipe-related API endpoints including:
- URL-based recipe extraction (Instagram, websites)
- Image-based recipe extraction (OCR)
- User recipe management
- Supported domains information
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, Header
from typing import List, Optional
from pydantic import BaseModel

# Local imports
from models.schemas import InstagramURL
from services.recipe_extraction_service import recipe_extraction_service
from services.image_service import process_multiple_recipe_images
from services.auth_service import get_current_user
from services.db_service import get_user_recipes
from utils.constants import Messages, StatusCodes
from utils.helpers import setup_logger, format_error_response, format_success_response

# Setup logging
logger = setup_logger(__name__)

router = APIRouter(prefix="/api", tags=["recipes"])

@router.post("/extract")
async def extract_recipe(data: InstagramURL, authorization: Optional[str] = Header(None)):
    """
    Extract recipe from URL (Instagram posts, recipe websites, general web content)
    
    Supports multiple extraction strategies:
    - Instagram: Caption-based extraction
    - Recipe sites: JSON-LD, microdata, CSS selectors
    - General web: Content-based extraction
    """
    if not data.url:
        raise HTTPException(
            status_code=StatusCodes.BAD_REQUEST, 
            detail=Messages.INVALID_URL
        )
    
    try:
        # Get user ID from auth header (optional for now)
        user_id = await get_current_user(authorization)
        logger.info(f"Extracting recipe from URL: {data.url} for user: {user_id}")
        
        result = await recipe_extraction_service.extract_recipe_from_url(data.url, user_id)
        
        if "error" in result:
            logger.error(f"Extraction failed for URL {data.url}: {result['error']}")
            raise HTTPException(
                status_code=StatusCodes.INTERNAL_ERROR, 
                detail=result["error"]
            )
        
        logger.info(f"Successfully extracted recipe from URL: {data.url}")
        return format_success_response(result, Messages.RECIPE_EXTRACTED_SUCCESS)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during extraction: {str(e)}")
        raise HTTPException(
            status_code=StatusCodes.INTERNAL_ERROR,
            detail=Messages.EXTRACTION_FAILED
        )

@router.post("/extract-images")
async def extract_recipe_from_images(
    images: List[UploadFile] = File(...), 
    background_tasks: BackgroundTasks = None, 
    authorization: Optional[str] = Header(None)
):
    """
    Extract recipe from uploaded images using OCR technology
    
    Supports multiple image formats and uses Tesseract OCR for text extraction.
    """
    if not images or len(images) == 0:
        raise HTTPException(
            status_code=StatusCodes.BAD_REQUEST, 
            detail="No images provided"
        )
    
    try:
        # Get user ID from auth header (optional for now)
        user_id = await get_current_user(authorization)
        logger.info(f"Processing {len(images)} images for user: {user_id}")
        
        result = await process_multiple_recipe_images(images, background_tasks, user_id)
        
        logger.info(f"Successfully processed {len(images)} images")
        return format_success_response(result, Messages.RECIPE_EXTRACTED_SUCCESS)
        
    except Exception as e:
        logger.error(f"Error processing images: {str(e)}")
        raise HTTPException(
            status_code=StatusCodes.INTERNAL_ERROR,
            detail=f"Failed to process images: {str(e)}"
        )

@router.post("/extract-pdf")
async def extract_recipe_from_pdf(
    pdf: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    authorization: Optional[str] = Header(None)
):
    """
    Extract recipe from uploaded PDF file
    
    Supports PDF text extraction and OCR for scanned PDFs.
    Uses PyPDF2 for text-based PDFs and falls back to OCR for image-based PDFs.
    """
    if not pdf:
        raise HTTPException(
            status_code=StatusCodes.BAD_REQUEST,
            detail="No PDF file provided"
        )
    
    # Validate file type
    if not pdf.content_type or not pdf.content_type.startswith('application/pdf'):
        raise HTTPException(
            status_code=StatusCodes.BAD_REQUEST,
            detail="File must be a PDF"
        )
    
    try:
        # Get user ID from auth header (optional for now)
        user_id = await get_current_user(authorization)
        logger.info(f"Processing PDF file '{pdf.filename}' for user: {user_id}")
        
        # Import the PDF processing service
        from services.pdf_service import process_recipe_pdf
        result = await process_recipe_pdf(pdf, background_tasks, user_id)
        
        logger.info(f"Successfully processed PDF file: {pdf.filename}")
        return format_success_response(result, Messages.RECIPE_EXTRACTED_SUCCESS)
        
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}")
        raise HTTPException(
            status_code=StatusCodes.INTERNAL_ERROR,
            detail=f"Failed to process PDF: {str(e)}"
        )


class RecipeText(BaseModel):
    text: str


@router.post("/extract-text")
async def extract_recipe_from_text(
    data: RecipeText,
    authorization: Optional[str] = Header(None)
):
    """
    Extract recipe from raw text content
    
    Processes pasted recipe text using AI to extract structured recipe data.
    """
    if not data.text or not data.text.strip():
        raise HTTPException(
            status_code=StatusCodes.BAD_REQUEST,
            detail="No text content provided"
        )
    
    try:
        # Get user ID from auth header (optional for now)
        user_id = await get_current_user(authorization)
        logger.info(f"Processing text recipe for user: {user_id}")
        
        result = await recipe_extraction_service.extract_recipe_from_text(data.text, user_id)
        
        logger.info("Successfully processed text recipe")
        return format_success_response(result, Messages.RECIPE_EXTRACTED_SUCCESS)
        
    except Exception as e:
        logger.error(f"Error processing text recipe: {str(e)}")
        raise HTTPException(
            status_code=StatusCodes.INTERNAL_ERROR,
            detail=f"Failed to process text recipe: {str(e)}"
        )


@router.get("/recipes")
async def get_recipes(authorization: Optional[str] = Header(None)):
    """
    Get recipes for the authenticated user
    
    Returns user-specific recipes when authenticated, empty list otherwise.
    """
    try:
        user_id = await get_current_user(authorization)
        
        if user_id:
            logger.info(f"Fetching recipes for user: {user_id}")
            # Extract auth token for RLS context
            auth_token = authorization.split(" ")[1] if authorization and authorization.startswith("Bearer ") else None
            recipes = await get_user_recipes(user_id, auth_token)
            return format_success_response(
                {"recipes": recipes, "user_specific": True}, 
                f"Found {len(recipes)} recipes"
            )
        else:
            return format_success_response(
                {"recipes": [], "user_specific": False}, 
                Messages.USER_NOT_AUTHENTICATED
            )
            
    except Exception as e:
        logger.error(f"Error fetching recipes: {str(e)}")
        raise HTTPException(
            status_code=StatusCodes.INTERNAL_ERROR,
            detail="Failed to fetch recipes"
        )