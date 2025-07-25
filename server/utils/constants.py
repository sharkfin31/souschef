"""
Constants and configuration values for SousChef API
"""

# API Response Messages
class Messages:
    RECIPE_EXTRACTED_SUCCESS = "Recipe extracted successfully"
    RECIPE_SAVED_SUCCESS = "Recipe saved successfully"
    USER_NOT_AUTHENTICATED = "User not authenticated"
    INVALID_URL = "Invalid URL provided"
    EXTRACTION_FAILED = "Failed to extract recipe from URL"
    USER_NOT_FOUND = "User not found"
    RECIPE_NOT_FOUND = "Recipe not found"
    PERMISSION_DENIED = "Permission denied"

# HTTP Status Codes
class StatusCodes:
    SUCCESS = 200
    CREATED = 201
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    INTERNAL_ERROR = 500

# File Upload Configuration
class FileConfig:
    MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
    ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"}
    
# OCR Configuration
class OCRConfig:
    CONFIG = "--oem 3 --psm 6"  # Optimized OCR configuration

# URL Validation
class URLPatterns:
    INSTAGRAM_DOMAINS = ['instagram.com', 'www.instagram.com']
    
# Recipe Website Domains (well-supported sites)
SUPPORTED_RECIPE_DOMAINS = [
    {
        "domain": "allrecipes.com",
        "confidence": "high",
        "notes": "Excellent JSON-LD support"
    },
    {
        "domain": "foodnetwork.com", 
        "confidence": "high",
        "notes": "Good structured data"
    },
    {
        "domain": "food.com",
        "confidence": "high",
        "notes": "Clean markup"
    },
    {
        "domain": "epicurious.com",
        "confidence": "high",
        "notes": "Professional food site"
    },
    {
        "domain": "bonappetit.com",
        "confidence": "medium",
        "notes": "Good content structure"
    },
    {
        "domain": "seriouseats.com",
        "confidence": "high",
        "notes": "Detailed recipes"
    },
    {
        "domain": "tasteofhome.com",
        "confidence": "medium",
        "notes": "Home cooking focus"
    },
    {
        "domain": "delish.com",
        "confidence": "medium", 
        "notes": "Popular recipe site"
    }
]
