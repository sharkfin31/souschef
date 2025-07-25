"""
Test script for the recipe extraction service
Run this to verify the unified service works correctly
"""
import asyncio
import sys
import os

# Add the parent directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.recipe_extraction_service import recipe_extraction_service

async def test_url_validation():
    """Test URL validation functionality"""
    print("Testing URL validation...")
    
    # Valid URLs
    valid_urls = [
        "https://www.instagram.com/p/ABC123/",
        "https://www.foodnetwork.com/recipes/example-recipe",
        "https://www.allrecipes.com/recipe/123/example",
        "http://example.com/recipe"
    ]
    
    # Invalid URLs
    invalid_urls = [
        "",
        "not-a-url",
        "ftp://example.com",
        "javascript:alert('xss')"
    ]
    
    service = recipe_extraction_service
    
    for url in valid_urls:
        if service._is_valid_url(url):
            print(f"✅ Valid URL: {url}")
        else:
            print(f"❌ Should be valid: {url}")
    
    for url in invalid_urls:
        if not service._is_valid_url(url):
            print(f"✅ Invalid URL correctly rejected: {url}")
        else:
            print(f"❌ Should be invalid: {url}")

async def test_instagram_routing():
    """Test Instagram URL detection"""
    print("\nTesting Instagram URL routing...")
    
    from services.instagram_service import validate_instagram_url
    
    instagram_urls = [
        "https://www.instagram.com/p/ABC123/",
        "https://instagram.com/reel/XYZ789/",
        "https://www.instagram.com/tv/DEF456/"
    ]
    
    non_instagram_urls = [
        "https://www.foodnetwork.com/recipes/example",
        "https://www.allrecipes.com/recipe/123",
        "https://example.com/recipe"
    ]
    
    for url in instagram_urls:
        if validate_instagram_url(url):
            print(f"✅ Instagram URL detected: {url}")
        else:
            print(f"❌ Should detect Instagram: {url}")
    
    for url in non_instagram_urls:
        if not validate_instagram_url(url):
            print(f"✅ Non-Instagram URL correctly identified: {url}")
        else:
            print(f"❌ Should not detect as Instagram: {url}")

async def test_content_extraction():
    """Test HTML content extraction methods"""
    print("\nTesting content extraction methods...")
    
    # Sample HTML with JSON-LD
    sample_html = '''
    <html>
    <head>
        <script type="application/ld+json">
        {
            "@type": "Recipe",
            "name": "Test Recipe",
            "description": "A test recipe",
            "recipeIngredient": ["1 cup flour", "2 eggs"],
            "recipeInstructions": [
                {"text": "Mix ingredients"},
                {"text": "Bake for 30 minutes"}
            ]
        }
        </script>
    </head>
    <body>
        <h1>Test Recipe</h1>
        <ul class="ingredients">
            <li>1 cup flour</li>
            <li>2 eggs</li>
        </ul>
    </body>
    </html>
    '''
    
    service = recipe_extraction_service
    content = await service._extract_recipe_content_from_html(sample_html, "https://example.com")
    
    if content and "Test Recipe" in content:
        print("✅ Content extraction working")
        print(f"Extracted content preview: {content[:100]}...")
    else:
        print("❌ Content extraction failed")

async def main():
    """Run all tests"""
    print("🧪 Testing Recipe Extraction Service\n")
    
    try:
        await test_url_validation()
        await test_instagram_routing()
        await test_content_extraction()
        
        print("\n✅ All basic tests completed!")
        print("\nNote: To test full extraction, try with real URLs:")
        print("- Instagram post with recipe in caption")
        print("- Recipe website like AllRecipes or Food Network")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
