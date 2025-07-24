import instaloader
import re
from services.ai_service import process_with_ai
from services.db_service import save_recipe_to_db

async def get_recipe_from_instagram(url):
    """Extract recipe information from Instagram post"""
    shortcode_match = re.search(r'/p/([\w-]+)|/reel/([\w-]+)', url)
    if not shortcode_match:
        return {"error": "Could not extract post ID from URL"}
    
    shortcode = shortcode_match.group(1) or shortcode_match.group(2)
    L = instaloader.Instaloader()
    
    try:
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        image_url = post.url
        recipe_content = ""
        
        if post.caption:
            recipe_content += post.caption + "\n\n"
        
        if not recipe_content.strip():
            return {"error": "No recipe content found in post"}
        
        recipe_data = await process_with_ai(recipe_content)
        if not recipe_data:
            return {"error": "Failed to process recipe with AI"}
        
        recipe_id = await save_recipe_to_db(recipe_data, url, image_url)
        if not recipe_id:
            return {"error": "Failed to save recipe to database"}
        
        return {
            "success": True,
            "recipe_id": recipe_id,
            "post_url": url,
            "username": post.owner_username,
            "title": recipe_data.get("title", "Untitled Recipe"),
            "ingredients": recipe_data.get("ingredients", []),
            "instructions": recipe_data.get("instructions", []),
            "image_url": image_url,
            "image_url": image_url
        }
    
    except Exception as e:
        return {"error": str(e)}