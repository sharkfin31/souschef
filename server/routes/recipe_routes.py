from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, Header
from typing import List, Optional

# Use local imports
from models.schemas import InstagramURL
from services.recipe_extraction_service import recipe_extraction_service
from services.image_service import process_multiple_recipe_images
from services.auth_service import get_current_user, require_auth
from services.db_service import get_user_recipes

router = APIRouter(prefix="/api", tags=["recipes"])

@router.post("/extract")
async def extract_recipe(data: InstagramURL, authorization: Optional[str] = Header(None)):
    if not data.url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    # Get user ID from auth header (optional for now)
    user_id = await get_current_user(authorization)
    
    result = await recipe_extraction_service.extract_recipe_from_url(data.url, user_id)
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result

@router.post("/extract-images")
async def extract_recipe_from_images(
    images: List[UploadFile] = File(...), 
    background_tasks: BackgroundTasks = None, 
    authorization: Optional[str] = Header(None)
):
    if not images or len(images) == 0:
        raise HTTPException(status_code=400, detail="No images provided")
    
    # Get user ID from auth header (optional for now)
    user_id = await get_current_user(authorization)
    
    return await process_multiple_recipe_images(images, background_tasks, user_id)

@router.get("/recipes")
async def get_recipes(authorization: Optional[str] = Header(None)):
    """Get recipes for the authenticated user, or all recipes if not authenticated"""
    user_id = await get_current_user(authorization)
    
    if user_id:
        # Return user-specific recipes
        recipes = await get_user_recipes(user_id)
        return {"recipes": recipes, "user_specific": True}
    else:
        # For backward compatibility, return empty list or require authentication
        return {"recipes": [], "user_specific": False, "message": "Please log in to view your recipes"}

@router.get("/supported-domains")
async def get_supported_domains():
    """Get list of well-supported recipe domains"""
    return {
        "instagram": {
            "domain": "instagram.com",
            "supported": True,
            "notes": "Posts with recipe content in captions"
        },
        "recipe_sites": [
            {
                "domain": "allrecipes.com",
                "supported": True,
                "confidence": "high"
            },
            {
                "domain": "foodnetwork.com", 
                "supported": True,
                "confidence": "high"
            },
            {
                "domain": "food.com",
                "supported": True,
                "confidence": "high"
            },
            {
                "domain": "epicurious.com",
                "supported": True,
                "confidence": "high"
            },
            {
                "domain": "tasteofhome.com",
                "supported": True,
                "confidence": "medium"
            },
            {
                "domain": "simplyrecipes.com",
                "supported": True,
                "confidence": "medium"
            }
        ],
        "general_notes": "Most recipe websites with structured data (JSON-LD, microdata) are supported"
    }

@router.get("/health")
async def health_check():
    """Health check endpoint with service information"""
    return {
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
    }