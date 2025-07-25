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

# Local imports
from models.schemas import InstagramURL
from services.recipe_extraction_service import recipe_extraction_service
from services.image_service import process_multiple_recipe_images
from services.auth_service import get_current_user, require_auth
from services.db_service import get_user_recipes
from utils.constants import Messages, StatusCodes, SUPPORTED_RECIPE_DOMAINS
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
            recipes = await get_user_recipes(user_id)
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

@router.get("/supported-domains")
async def get_supported_domains():
    """
    Get list of well-supported recipe domains
    
    Returns information about websites and sources that have 
    high-quality recipe extraction support.
    """
    return format_success_response({
        "instagram": {
            "domain": "instagram.com",
            "supported": True,
            "notes": "Posts with recipe content in captions"
        },
        "recipe_sites": SUPPORTED_RECIPE_DOMAINS,
        "general_web": {
            "supported": True,
            "notes": "Any website with readable recipe content",
            "confidence": "variable"
        }
    }, "Supported domains retrieved successfully")

@router.get("/health")
async def health_check():
    """
    Health check endpoint with service information
    
    Returns the operational status of all recipe-related services.
    """
    return format_success_response({
        "status": "healthy",
        "services": {
            "recipe_extraction": "active",
            "instagram_support": "active", 
            "web_scraping": "active",
            "image_extraction": "active",
            "ai_processing": "active"
        },
        "supported_sources": [
            "Instagram posts",
            "Recipe websites", 
            "Food blogs",
            "Image uploads (OCR)"
        ],
        "version": "2.0.0"
    }, "Service health check completed")