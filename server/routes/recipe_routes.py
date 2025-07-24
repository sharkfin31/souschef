from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from typing import List

# Use local imports
from models.schemas import InstagramURL
from services.instagram_service import get_recipe_from_instagram
from services.image_service import process_multiple_recipe_images

router = APIRouter(prefix="/api", tags=["recipes"])

@router.post("/extract")
async def extract_recipe(data: InstagramURL):
    if not data.url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    result = await get_recipe_from_instagram(data.url)
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result

@router.post("/extract-images")
async def extract_recipe_from_images(images: List[UploadFile] = File(...), background_tasks: BackgroundTasks = None):
    if not images or len(images) == 0:
        raise HTTPException(status_code=400, detail="No images provided")
    return await process_multiple_recipe_images(images, background_tasks)

@router.get("/health")
async def health_check():
    return {"status": "healthy"}