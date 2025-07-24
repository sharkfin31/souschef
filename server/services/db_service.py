import os
from config import supabase

async def save_recipe_to_db(recipe_data, source_url, image_url=None):
    """Save recipe to Supabase database"""
    try:
        # Insert recipe
        recipe_id = os.urandom(16).hex()
        recipe_insert = {
            "id": recipe_id,
            "title": recipe_data.get("title", "Untitled Recipe"),
            "description": recipe_data.get("description", ""),
            "source_url": source_url,
            "image_url": image_url
        }
        
        supabase.table("recipes").insert(recipe_insert).execute()
        
        # Insert ingredients
        ingredients = recipe_data.get("ingredients", [])
        if ingredients:
            ingredient_inserts = []
            for ingredient in ingredients:
                ingredient_inserts.append({
                    "id": os.urandom(16).hex(),
                    "recipe_id": recipe_id,
                    "name": ingredient.get("name", ""),
                    "quantity": ingredient.get("quantity", ""),
                    "unit": ingredient.get("unit", "")
                })
            
            supabase.table("ingredients").insert(ingredient_inserts).execute()
        
        # Insert instructions
        instructions = recipe_data.get("instructions", [])
        if instructions:
            instruction_inserts = []
            for instruction in instructions:
                instruction_inserts.append({
                    "id": os.urandom(16).hex(),
                    "recipe_id": recipe_id,
                    "step_number": instruction.get("stepNumber", 0),
                    "description": instruction.get("description", "")
                })
            
            supabase.table("instructions").insert(instruction_inserts).execute()
        
        return recipe_id
    except Exception as e:
        print(f"Database error: {e}")
        return None