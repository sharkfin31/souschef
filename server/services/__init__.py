"""
Services module for SousChef API

This module contains all business logic services for recipe processing,
authentication, database operations, and external integrations.
"""

from .ai_service import process_with_ai
from .auth_service import get_current_user
from .db_service import (
    save_recipe_to_db,
    get_user_recipes,
    get_user_recipe_by_id,
    update_recipe_metadata
)
from .recipe_extraction_service import RecipeExtractionService, recipe_extraction_service
from .instagram_service import get_recipe_from_instagram
from .image_service import process_multiple_recipe_images

__all__ = [
    # AI Service
    'process_with_ai',
    
    # Auth Service
    'get_current_user',
    
    # Database Service
    'save_recipe_to_db',
    'get_user_recipes',
    'get_user_recipe_by_id',
    'update_recipe_metadata',
    
    # Extraction Services
    'RecipeExtractionService',
    'recipe_extraction_service',
    'get_recipe_from_instagram',
    
    # Image Service
    'process_multiple_recipe_images',
]
