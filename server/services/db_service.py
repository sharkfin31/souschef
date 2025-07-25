import os
from typing import Dict, Any, Optional
from config import supabase

async def save_recipe_to_db(recipe_data: Dict[str, Any], source_url: str, image_url: Optional[str] = None, user_id: Optional[str] = None) -> Optional[str]:
    """Save recipe to Supabase database with enhanced fields and user association"""
    try:
        # Generate unique recipe ID
        recipe_id = os.urandom(16).hex()
        
        # Prepare recipe data with new fields
        recipe_insert = {
            "id": recipe_id,
            "title": recipe_data.get("title", "Untitled Recipe"),
            "description": recipe_data.get("description", ""),
            "prep_time": recipe_data.get("prepTime"),
            "cook_time": recipe_data.get("cookTime"), 
            "total_time": recipe_data.get("totalTime"),
            "servings": recipe_data.get("servings"),
            "difficulty": recipe_data.get("difficulty"),
            "nutrition_notes": recipe_data.get("nutritionNotes"),
            "source_url": source_url,
            "image_url": image_url,
            "user_id": user_id,  # Associate recipe with user
            "tags": recipe_data.get("tags", [])  # Store as JSON array
        }
        
        # Remove None values to avoid database issues
        recipe_insert = {k: v for k, v in recipe_insert.items() if v is not None}
        
        # Insert recipe
        recipe_result = supabase.table("recipes").insert(recipe_insert).execute()
        if not recipe_result.data:
            print("Failed to insert recipe")
            return None
        
        # Insert ingredients with better error handling
        ingredients = recipe_data.get("ingredients", [])
        if ingredients:
            ingredient_inserts = []
            for ingredient in ingredients:
                ingredient_data = {
                    "id": os.urandom(16).hex(),
                    "recipe_id": recipe_id,
                    "name": ingredient.get("name", "").strip(),
                    "quantity": ingredient.get("quantity", "").strip(),
                    "unit": ingredient.get("unit", "").strip() if ingredient.get("unit") else None
                }
                ingredient_inserts.append(ingredient_data)
            
            try:
                ingredient_result = supabase.table("ingredients").insert(ingredient_inserts).execute()
                if not ingredient_result.data:
                    print("Warning: Failed to insert some ingredients")
            except Exception as e:
                print(f"Error inserting ingredients: {e}")
        
        # Insert instructions with time estimates
        instructions = recipe_data.get("instructions", [])
        if instructions:
            instruction_inserts = []
            for instruction in instructions:
                instruction_data = {
                    "id": os.urandom(16).hex(),
                    "recipe_id": recipe_id,
                    "step_number": instruction.get("stepNumber", 0),
                    "description": instruction.get("description", "").strip(),
                    "time_estimate": instruction.get("timeEstimate")
                }
                instruction_inserts.append(instruction_data)
            
            try:
                instruction_result = supabase.table("instructions").insert(instruction_inserts).execute()
                if not instruction_result.data:
                    print("Warning: Failed to insert some instructions")
            except Exception as e:
                print(f"Error inserting instructions: {e}")
        
        # Insert cooking tips if available
        tips = recipe_data.get("tips", [])
        if tips:
            tip_inserts = []
            for i, tip in enumerate(tips):
                tip_data = {
                    "id": os.urandom(16).hex(),
                    "recipe_id": recipe_id,
                    "tip_number": i + 1,
                    "description": tip.strip()
                }
                tip_inserts.append(tip_data)
            
            try:
                # Note: This assumes you have a tips table. If not, we can store tips in recipe metadata
                supabase.table("recipe_tips").insert(tip_inserts).execute()
            except Exception as e:
                print(f"Info: Tips table not available or error inserting tips: {e}")
        
        print(f"Successfully saved recipe {recipe_id}: {recipe_data.get('title')} for user {user_id}")
        return recipe_id
        
    except Exception as e:
        print(f"Database error saving recipe: {e}")
        print(f"Recipe data: {recipe_data}")
        return None

async def get_user_recipes(user_id: str) -> list:
    """Get all recipes for a specific user"""
    try:
        result = supabase.table("recipes").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return result.data if result.data else []
    except Exception as e:
        print(f"Error fetching user recipes: {e}")
        return []

async def get_user_recipe_by_id(recipe_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific recipe for a user (with user verification)"""
    try:
        result = supabase.table("recipes").select("*").eq("id", recipe_id).eq("user_id", user_id).single().execute()
        return result.data if result.data else None
    except Exception as e:
        print(f"Error fetching user recipe: {e}")
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
        print(f"Error updating recipe metadata: {e}")
        return False