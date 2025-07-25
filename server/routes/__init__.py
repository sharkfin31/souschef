"""
Routes module for SousChef API

This module contains all API route handlers for the application.
"""

from .recipe_routes import router as recipe_router
from .grocery_routes import router as grocery_router

__all__ = [
    'recipe_router',
    'grocery_router',
]
