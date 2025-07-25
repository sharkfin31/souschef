"""
SousChef API - Main FastAPI Application

A unified recipe extraction and management API that supports multiple URL types
including Instagram posts and recipe websites.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import sys
import logging
from pathlib import Path

# Add the parent directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import routes using the new module structure
from routes import recipe_router, grocery_router
from config import UPLOAD_DIR
from utils import setup_logger

# Setup logging
logger = setup_logger(__name__)

# FastAPI app with enhanced metadata
app = FastAPI(
    title="SousChef API", 
    description="""
    A unified recipe extraction and management API with the following features:
    
    - **Multi-source recipe extraction**: Instagram posts, recipe websites, general web content
    - **User authentication**: JWT-based user management with Supabase
    - **Image processing**: OCR-based recipe extraction from images
    - **Grocery list management**: Share lists via WhatsApp/SMS
    - **Advanced filtering**: Search and filter recipes by tags, time, ingredients
    
    The API uses intelligent content extraction strategies including JSON-LD, 
    microdata, and CSS selector-based extraction for optimal recipe parsing.
    """,
    version="2.0.0",
    contact={
        "name": "SousChef API Support",
        "url": "https://github.com/your-repo/souschef",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Mount static files directory for uploaded content
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include API routers
app.include_router(recipe_router)
app.include_router(grocery_router)

@app.get("/", tags=["root"])
async def read_root():
    """Root endpoint with API information"""
    return {
        "message": "Welcome to SousChef API",
        "version": "2.0.0",
        "docs": "/docs",
        "features": [
            "Multi-source recipe extraction",
            "User authentication", 
            "Image OCR processing",
            "Grocery list sharing"
        ]
    }

@app.get("/health", tags=["monitoring"])
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "services": {
            "api": "operational",
            "database": "operational",
            "ai_service": "operational"
        }
    }

# Application startup event
@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("Starting SousChef API v2.0.0")
    logger.info(f"Upload directory: {UPLOAD_DIR}")

# Application shutdown event  
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    logger.info("Shutting down SousChef API")

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('PORT', 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run(
        "app:app", 
        host="0.0.0.0", 
        port=port, 
        reload=True,
        log_level="info"
    )