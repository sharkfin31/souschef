import os
from typing import Dict, Any, Optional
from config import supabase
from utils.helpers import setup_logger

# Setup logging
logger = setup_logger(__name__)

def safe_strip(value):
    """Safely strip a value, handling None and non-string types"""
    if value is None:
        return ""
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else ""
    # For non-string values, convert to string and strip
    str_value = str(value).strip()
    return str_value if str_value else ""

def safe_int(value, default=None):
    """Safely convert a value to int, handling None and invalid values"""
    if value is None:
        return default
    try:
        # If it's already an int, return it
        if isinstance(value, int):
            return value
        
        # If it's a string, try to extract numeric part
        if isinstance(value, str):
            # Remove common units and text
            clean_value = value.strip().lower()
            clean_value = clean_value.replace('minutes', '').replace('mins', '').replace('min', '')
            clean_value = clean_value.replace('hours', '').replace('hrs', '').replace('hr', '')
            clean_value = clean_value.replace('servings', '').replace('serving', '')
            clean_value = clean_value.strip()
            
            # Handle ranges by taking the first number
            if '-' in clean_value:
                parts = clean_value.split('-')
                if parts[0].strip():
                    clean_value = parts[0].strip()
            
            # Convert to int
            return int(float(clean_value))
        
        # For other types, try direct conversion
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_float(value, default=None):
    """Safely convert a value to float, handling None and invalid values"""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def normalize_quantity(quantity_str):
    """
    Normalize quantity strings to single numeric values
    Handles ranges like "1-2", "7-8" and converts to middle value
    For ranges of whole numbers >= 7, rounds down (e.g., "7-8" -> "7")
    """
    if not quantity_str:
        return "1"  # Default quantity
    
    quantity_str = safe_strip(quantity_str)
    if not quantity_str:
        return "1"
    
    # Handle ranges like "1-2", "7-8", "1/2-3/4"
    if '-' in quantity_str:
        try:
            parts = quantity_str.split('-')
            if len(parts) == 2 and parts[0].strip() and parts[1].strip():
                # Convert fractions to decimals if needed
                start = parse_fraction_or_number(parts[0].strip())
                end = parse_fraction_or_number(parts[1].strip())
                if start is not None and end is not None and start >= 0 and end >= 0:
                    # For count items (whole numbers >= 7), use the lower value
                    if start >= 7 and end >= 7 and start == int(start) and end == int(end):
                        return str(int(start))
                    else:
                        middle = (start + end) / 2
                        # Return as string, rounded to 1 decimal place if needed
                        return str(int(middle)) if middle == int(middle) else f"{middle:.1f}"
        except:
            pass
    
    # Handle single values including fractions
    parsed = parse_fraction_or_number(quantity_str)
    if parsed is not None and parsed >= 0:
        return str(int(parsed)) if parsed == int(parsed) else f"{parsed:.1f}"
    
    # If all parsing fails, return default
    return "1"

def parse_fraction_or_number(value_str):
    """Parse a string that might be a fraction (like '1/2') or a number"""
    try:
        # Handle fractions like "1/2", "3/4"
        if '/' in value_str:
            parts = value_str.split('/')
            if len(parts) == 2:
                numerator = float(parts[0].strip())
                denominator = float(parts[1].strip())
                if denominator != 0:
                    return numerator / denominator
        
        # Handle regular numbers
        return float(value_str)
    except:
        return None

async def save_recipe_to_db(recipe_data: Dict[str, Any], source_url: str, image_url: Optional[str] = None, user_id: Optional[str] = None) -> Optional[str]:
    """Save recipe to Supabase database with enhanced fields and user association"""
    try:
        # Generate unique recipe ID
        recipe_id = os.urandom(16).hex()
        
        # Prepare recipe data with new fields and proper type validation
        recipe_insert = {
            "id": recipe_id,
            "title": safe_strip(recipe_data.get("title")) or "Untitled Recipe",
            "description": safe_strip(recipe_data.get("description")) or "",
            "prep_time": safe_int(recipe_data.get("prepTime")),
            "cook_time": safe_int(recipe_data.get("cookTime")), 
            "total_time": safe_int(recipe_data.get("totalTime")),
            "servings": safe_int(recipe_data.get("servings")),
            "difficulty": safe_strip(recipe_data.get("difficulty")),
            "nutrition_notes": safe_strip(recipe_data.get("nutritionNotes")),
            "source_url": source_url,
            "image_url": image_url,
            "user_id": user_id,  # Associate recipe with user
            "tags": recipe_data.get("tags", []) if isinstance(recipe_data.get("tags"), list) else []
        }
        
        # Remove None values to avoid database issues
        recipe_insert = {k: v for k, v in recipe_insert.items() if v is not None}
        
        # Insert recipe
        recipe_result = supabase.table("recipes").insert(recipe_insert).execute()
        if not recipe_result.data:
            logger.error("Failed to insert recipe")
            return None
        
        # Insert ingredients with better error handling
        ingredients = recipe_data.get("ingredients", [])
        if ingredients:
            ingredient_inserts = []
            for i, ingredient in enumerate(ingredients):

                # Safely handle all values
                name = safe_strip(ingredient.get("name"))
                raw_quantity = ingredient.get("quantity")
                normalized_quantity = normalize_quantity(raw_quantity)
                unit = safe_strip(ingredient.get("unit"))
                
                if not name:  # Skip ingredients without names
                    logger.warn(f"Skipping ingredient {i} - no name provided")
                    continue
                
                ingredient_data = {
                    "id": os.urandom(16).hex(),
                    "recipe_id": recipe_id,
                    "name": name,
                    "quantity": normalized_quantity,
                    "unit": unit if unit else None
                }
                ingredient_inserts.append(ingredient_data)
            
            if ingredient_inserts:
                try:
                    ingredient_result = supabase.table("ingredients").insert(ingredient_inserts).execute()
                    if not ingredient_result.data:
                        logger.warn("Failed to insert some ingredients")
                except Exception as e:
                    logger.error(f"Error inserting ingredients: {e}")
        
        # Insert instructions with time estimates
        instructions = recipe_data.get("instructions", [])
        if instructions:
            instruction_inserts = []
            for i, instruction in enumerate(instructions):
                
                # Safely handle all values
                description = safe_strip(instruction.get("description"))
                step_number = safe_int(instruction.get("stepNumber"), i + 1)
                time_estimate = safe_int(instruction.get("timeEstimate"))
                
                if not description:  # Skip instructions without descriptions
                    logger.warn(f"Skipping instruction {i} - no description provided")
                    continue
                
                instruction_data = {
                    "id": os.urandom(16).hex(),
                    "recipe_id": recipe_id,
                    "step_number": step_number,
                    "description": description,
                    "time_estimate": time_estimate
                }
                instruction_inserts.append(instruction_data)
            
            if instruction_inserts:
                try:
                    instruction_result = supabase.table("instructions").insert(instruction_inserts).execute()
                    if not instruction_result.data:
                        logger.warn("Failed to insert some instructions")
                except Exception as e:
                    logger.error(f"Error inserting instructions: {e}")
        
        logger.info(f"Successfully saved recipe {recipe_id}: {recipe_data.get('title')} for user {user_id}")
        return recipe_id
        
    except Exception as e:
        logger.error(f"Database error saving recipe: {e}")
        return None

async def get_user_recipes(user_id: str) -> list:
    """Get all recipes for a specific user"""
    try:
        result = supabase.table("recipes").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching user recipes: {e}")
        return []

async def get_user_recipe_by_id(recipe_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific recipe for a user (with user verification)"""
    try:
        result = supabase.table("recipes").select("*").eq("id", recipe_id).eq("user_id", user_id).single().execute()
        return result.data if result.data else None
    except Exception as e:
        logger.error(f"Error fetching user recipe: {e}")
        return None


async def update_recipe_metadata(recipe_id: str, metadata: Dict[str, Any], user_id: str) -> bool:
    """Update recipe metadata like prep time, cook time, etc. with user verification"""
    try:
        update_data = {}
        
        # Map metadata fields to database columns
        field_mapping = {
            "prepTime": "prep_time",
            "cookTime": "cook_time", 
            "totalTime": "total_time",
            "servings": "servings",
            "difficulty": "difficulty",
            "nutritionNotes": "nutrition_notes"
        }
        
        for key, value in metadata.items():
            if key in field_mapping and value is not None:
                update_data[field_mapping[key]] = value
        
        if update_data:
            result = supabase.table("recipes").update(update_data).eq("id", recipe_id).eq("user_id", user_id).execute()
            return bool(result.data)
        
        return False
        
    except Exception as e:
        logger.error(f"Error updating recipe metadata: {e}")
        return False

async def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user profile from Supabase profiles table"""
    try:
        result = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        return result.data
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        return None

async def delete_recipe(recipe_id: str, user_id: str) -> bool:
    """Delete a recipe and all its associated data (ingredients, instructions) for a specific user"""
    try:
        # Verify that the recipe belongs to the user before deleting
        recipe_check = supabase.table("recipes").select("id, user_id").eq("id", recipe_id).eq("user_id", user_id).single().execute()
        
        if not recipe_check.data:
            logger.warn(f"Recipe {recipe_id} not found or doesn't belong to user {user_id}")
            return False
        
        # Delete the recipe - this will cascade delete ingredients and instructions due to foreign key constraints
        result = supabase.table("recipes").delete().eq("id", recipe_id).eq("user_id", user_id).execute()
        
        if result.data:
            logger.info(f"Successfully deleted recipe {recipe_id} for user {user_id}")
            return True
        else:
            logger.warn(f"Failed to delete recipe {recipe_id}")
            return False
        
    except Exception as e:
        logger.error(f"Error deleting recipe: {e}")
        return False