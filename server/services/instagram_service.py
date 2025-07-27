"""
Instagram Service using Apify

This service extracts recipe content from Instagram posts using the Apify platform,
which provides reliable, maintained scrapers that handle Instagram's anti-bot measures.
"""

import re
import os
import json
import asyncio
import random
from typing import Dict, Any, Optional, List
from apify_client import ApifyClientAsync
from services.ai_service import process_with_ai
from services.db_service import save_recipe_to_db
from utils.helpers import setup_logger

# Setup logging
logger = setup_logger(__name__)

# Apify actor for Instagram scraping (popular public actor)
INSTAGRAM_ACTOR = os.getenv("APIFY_ACTOR", "apify/instagram-post-scraper")

# Global Apify client instance
_apify_client = None

def get_apify_client() -> ApifyClientAsync:
    """Get or create Apify async client instance"""
    global _apify_client
    
    if _apify_client is None:
        apify_token = os.getenv('APIFY_TOKEN')
        if not apify_token:
            logger.warning("APIFY_TOKEN not found in environment variables")
            logger.info("Some Apify actors may work without authentication, but setting APIFY_TOKEN is recommended")
        
        _apify_client = ApifyClientAsync(token=apify_token)
        logger.info("Created Apify async client")
    
    return _apify_client

def extract_instagram_shortcode(url: str) -> Optional[str]:
    """Extract shortcode from Instagram URL"""
    # Match various Instagram URL patterns and extract shortcode
    patterns = [
        r'instagram\.com/p/([A-Za-z0-9_-]+)',
        r'instagram\.com/reel/([A-Za-z0-9_-]+)',
        r'instagram\.com/tv/([A-Za-z0-9_-]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None

async def scrape_instagram_post(url: str) -> Dict[str, Any]:
    """
    Scrape Instagram post using Apify async client
    
    Args:
        url: Instagram post URL
        
    Returns:
        Dict containing scraped post data or error information
    """
    try:
        logger.info(f"Starting Apify scraping for URL: {url}")
        
        # Get Apify async client
        client = get_apify_client()
        
        # Extract shortcode for validation
        shortcode = extract_instagram_shortcode(url)
        if not shortcode:
            return {
                "error": "Invalid Instagram URL format",
                "message": "Please provide a valid Instagram post, reel, or TV URL.",
                "example": "https://www.instagram.com/p/ABC123/"
            }
        
        # Configure the run input for the Instagram scraper
        run_input = {
            "directUrls": [url],
            "resultsType": "posts",
            "resultsLimit": 1,
        }
        
        logger.info(f"Running Apify actor: {INSTAGRAM_ACTOR}")
        
        # Run the actor and get the results
        actor_client = client.actor(INSTAGRAM_ACTOR)
        run_result = await actor_client.call(run_input=run_input)
        
        # Get dataset items from the run
        run_client = actor_client.last_run()
        dataset_data = await run_client.dataset().list_items()
        
        if not dataset_data.items:
            return {
                "error": "No data found",
                "message": "The Instagram post could not be scraped or contains no data.",
                "suggestion": "The post may be private, deleted, or temporarily unavailable."
            }
        
        # Get the first (and should be only) result
        post_data = dataset_data.items[0]
        logger.info(f"Successfully scraped Instagram post: {shortcode}")
        
        return {
            "success": True,
            "data": post_data
        }
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Apify scraping error: {error_msg}")
        
        # Handle specific error types
        if "401" in error_msg or "Unauthorized" in error_msg:
            return {
                "error": "Authentication failed",
                "message": "Invalid or missing Apify token.",
                "suggestion": "Set the APIFY_TOKEN environment variable with a valid token."
            }
        elif "quota" in error_msg.lower() or "limit" in error_msg.lower():
            return {
                "error": "Usage quota exceeded", 
                "message": "Apify usage limits have been reached.",
                "suggestion": "Wait for quota reset or upgrade your Apify plan."
            }
        else:
            return {
                "error": "Scraping failed",
                "message": f"Unexpected error: {error_msg}",
                "suggestion": "Try again later or check if the Instagram post is publicly accessible."
            }

async def get_recipe_from_instagram(url: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract recipe information from Instagram post using Apify
    
    Args:
        url: Instagram post URL
        user_id: Optional user ID for database association
        
    Returns:
        Dict containing extracted recipe data or error information
    """
    try:
        logger.info(f"Starting Instagram recipe extraction for URL: {url}")
        
        # Add small delay to be respectful
        await asyncio.sleep(random.uniform(1, 2))
        
        # Scrape the Instagram post
        scrape_result = await scrape_instagram_post(url)
        
        if not scrape_result.get("success"):
            return scrape_result
        
        post_data = scrape_result["data"]
        
        # Extract relevant content from the scraped data
        caption = post_data.get("caption", "")
        image_url = None
        username = post_data.get("ownerUsername", "")
        
        # Get image URL (try different fields that Apify might provide)
        if post_data.get("displayUrl"):
            image_url = post_data["displayUrl"]
        elif post_data.get("thumbnailSrc"):
            image_url = post_data["thumbnailSrc"]
        elif post_data.get("images") and len(post_data["images"]) > 0:
            image_url = post_data["images"][0]
        
        # Validate content
        if not caption or not caption.strip():
            return {
                "error": "No recipe content found",
                "message": "The Instagram post doesn't contain any caption text with recipe information.",
                "suggestion": "Make sure the post has recipe details in the caption.",
                "post_data": {
                    "username": username,
                    "likes": post_data.get("likesCount", 0),
                    "comments": post_data.get("commentsCount", 0)
                }
            }
        
        logger.info(f"Processing {len(caption)} characters with AI")
        
        # Process content with AI
        recipe_data = await process_with_ai(caption)
        if not recipe_data:
            return {
                "error": "Failed to extract recipe information",
                "message": "The AI couldn't identify recipe content in the post.",
                "suggestion": "Ensure the post contains clear recipe instructions and ingredients.",
                "raw_caption": caption[:200] + "..." if len(caption) > 200 else caption
            }
        
        # Save to database
        source_info = f"Instagram: @{username} - {url}" if username else f"Instagram: {url}"
        recipe_id = await save_recipe_to_db(recipe_data, source_info, image_url, user_id)
        
        if not recipe_id:
            return {
                "error": "Failed to save recipe",
                "message": "The recipe was extracted but couldn't be saved to the database."
            }
        
        logger.info(f"Successfully extracted and saved recipe: {recipe_data.get('title', 'Untitled')}")
        
        # Return successful result with additional Instagram data
        return {
            "success": True,
            "recipe_id": recipe_id,
            "source_url": url,  # Use source_url for consistency with web extraction
            "post_url": url,    # Keep post_url for backward compatibility
            "username": username,
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
            "source": "instagram",
            "extracted_via": "apify",
            "instagram_data": {
                "likes": post_data.get("likesCount", 0),
                "comments": post_data.get("commentsCount", 0),
                "timestamp": post_data.get("timestamp"),
                "shortcode": extract_instagram_shortcode(url)
            }
        }
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Unexpected error extracting from Instagram: {error_msg}")
        
        return {
            "error": "Instagram extraction failed",
            "message": f"An unexpected error occurred: {error_msg}",
            "suggestion": "Try again later or use the image upload feature with a screenshot of the post.",
            "alternative": "Copy the recipe text manually and paste it into a text editor."
        }

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

async def get_apify_status() -> Dict[str, Any]:
    """Get the current Apify service status"""
    try:
        apify_token = os.getenv('APIFY_TOKEN')
        client = get_apify_client()
        
        status = {
            "apify_token_configured": bool(apify_token),
            "client_initialized": _apify_client is not None,
            "actor_id": INSTAGRAM_ACTOR,
        }
        
        # Try to get user info if token is available
        if apify_token:
            try:
                user_info = await client.user().get()
                status["user_info"] = {
                    "id": user_info.get("id"),
                    "username": user_info.get("username"),
                    "email": user_info.get("email")
                }
                status["authenticated"] = True
            except Exception as e:
                status["authenticated"] = False
                status["auth_error"] = str(e)
        else:
            status["authenticated"] = False
            
        return status
        
    except Exception as e:
        return {
            "error": f"Failed to get Apify status: {e}",
            "apify_token_configured": bool(os.getenv('APIFY_TOKEN')),
            "client_initialized": False,
            "authenticated": False
        }

async def apify_setup_guide():
    """Log setup instructions for Apify Instagram scraping"""
    status = await get_apify_status()
    
    if not status.get('apify_token_configured', False):
        logger.warn("Apify token not configured - limited Instagram functionality")
        logger.info("To enable full Instagram features: Set APIFY_TOKEN environment variable")
        logger.info("Get token from: https://console.apify.com/account/integrations")
    else:
        logger.info(f"Instagram service ready - Using actor: {status.get('actor_id', 'N/A')}")
        
    if status.get('user_info'):
        user_info = status['user_info']
        print(f"   Account: {user_info.get('username', 'N/A')} ({user_info.get('email', 'N/A')})")
    
    print("\n4. ALTERNATIVE ACTORS:")
    print("   - Current: apify/instagram-post-scraper")
    print("   - Alternative: dtrungtin/instagram-scraper")
    print("   - Browse more at: https://apify.com/store")
    
    print("\n⚠️  Important Notes:")
    print("   - Keep your API token secure")
    print("   - Monitor your usage and costs")
    print("   - Some posts may still require authentication")
    print("   - Respect Instagram's terms of service")
    print("=" * 60)

# Helper function to test a specific Instagram URL
async def test_instagram_extraction(url: str) -> Dict[str, Any]:
    """Test Instagram extraction with a specific URL"""
    print(f"\n🧪 Testing Instagram extraction for: {url}")
    print("-" * 50)
    
    if not validate_instagram_url(url):
        print("❌ Invalid Instagram URL format")
        return {"error": "Invalid URL"}
    
    try:
        result = await get_recipe_from_instagram(url)
        
        if result.get("success"):
            print("✅ Extraction successful!")
            print(f"   Title: {result.get('title', 'N/A')}")
            print(f"   Username: @{result.get('username', 'N/A')}")
            print(f"   Ingredients: {len(result.get('ingredients', []))} items")
            print(f"   Instructions: {len(result.get('instructions', []))} steps")
            print(f"   Likes: {result.get('instagram_data', {}).get('likes', 0)}")
        else:
            print("❌ Extraction failed:")
            print(f"   Error: {result.get('error', 'Unknown error')}")
            print(f"   Message: {result.get('message', 'No details available')}")
            
        return result
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return {"error": str(e)}
