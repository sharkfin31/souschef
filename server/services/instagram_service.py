import instaloader
import re
from typing import Dict, Any, Optional
from services.ai_service import process_with_ai
from services.db_service import save_recipe_to_db

async def get_recipe_from_instagram(url: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Extract recipe information from Instagram post with enhanced error handling"""
    try:
        # Extract shortcode from URL with better regex
        shortcode_match = re.search(r'/(?:p|reel|tv)/([A-Za-z0-9_-]+)', url)
        if not shortcode_match:
            return {"error": "Invalid Instagram URL format. Please provide a valid post, reel, or TV URL."}
        
        shortcode = shortcode_match.group(1)
        print(f"Extracting recipe from Instagram post: {shortcode}")
        
        # Initialize Instaloader with minimal configuration
        L = instaloader.Instaloader(
            download_pictures=False,
            download_videos=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False
        )
        
        # Get post data
        try:
            post = instaloader.Post.from_shortcode(L.context, shortcode)
        except instaloader.exceptions.PostUnavailableException:
            return {"error": "Instagram post not found or is private. Please check the URL and privacy settings."}
        except instaloader.exceptions.LoginRequiredException:
            return {"error": "Instagram post requires login to access. Please try a public post."}
        except Exception as e:
            return {"error": f"Failed to access Instagram post: {str(e)}"}
        
        # Extract content
        recipe_content = ""
        image_url = None
        
        # Get caption
        if post.caption:
            recipe_content += post.caption.strip() + "\n\n"
        
        # Get image URL
        try:
            image_url = post.url
        except Exception as e:
            print(f"Warning: Could not get image URL: {e}")
        
        # Get additional text from post if available
        if hasattr(post, 'title') and post.title:
            recipe_content = f"Title: {post.title}\n\n" + recipe_content
        
        # Validate content
        if not recipe_content.strip():
            return {"error": "No recipe content found in the Instagram post caption."}
        
        if len(recipe_content.strip()) < 50:
            return {"error": "Instagram post caption is too short to contain a recipe. Please try a different post."}
        
        print(f"Extracted {len(recipe_content)} characters of content from Instagram post")
        
        # Process with AI
        recipe_data = await process_with_ai(recipe_content)
        if not recipe_data:
            return {"error": "Failed to extract recipe information from the post content. The AI could not parse the recipe."}
        
        # Save to database
        source_info = f"Instagram: @{post.owner_username} - {url}"
        recipe_id = await save_recipe_to_db(recipe_data, source_info, image_url, user_id)
        
        if not recipe_id:
            return {"error": "Failed to save recipe to database."}
        
        print(f"Successfully processed Instagram recipe: {recipe_data.get('title')}")
        
        return {
            "success": True,
            "recipe_id": recipe_id,
            "post_url": url,
            "username": post.owner_username,
            "title": recipe_data.get("title", "Untitled Recipe"),
            "description": recipe_data.get("description", ""),
            "prep_time": recipe_data.get("prepTime"),
            "cook_time": recipe_data.get("cookTime"),
            "total_time": recipe_data.get("totalTime"),
            "servings": recipe_data.get("servings"),
            "difficulty": recipe_data.get("difficulty"),
            "ingredients": recipe_data.get("ingredients", []),
            "instructions": recipe_data.get("instructions", []),
            "tags": recipe_data.get("tags", []),
            "image_url": image_url,
            "source": "instagram"
        }
        
    except Exception as e:
        print(f"Unexpected error processing Instagram URL: {e}")
        return {"error": f"An unexpected error occurred: {str(e)}"}


def validate_instagram_url(url: str) -> bool:
    """Validate if the provided URL is a valid Instagram post URL"""
    if not url or not isinstance(url, str):
        return False
    
    # Check for Instagram domain and valid post patterns
    instagram_patterns = [
        r'https?://(?:www\.)?instagram\.com/p/[A-Za-z0-9_-]+',
        r'https?://(?:www\.)?instagram\.com/reel/[A-Za-z0-9_-]+',
        r'https?://(?:www\.)?instagram\.com/tv/[A-Za-z0-9_-]+',
    ]
    
    return any(re.match(pattern, url.strip()) for pattern in instagram_patterns)