import re
from typing import Dict, Any, Optional
from urllib.parse import urlparse
from services.instagram_service import get_recipe_from_instagram, validate_instagram_url
from services.ai_service import process_with_ai
from services.db_service import save_recipe_to_db
from utils.helpers import setup_logger
import httpx
from bs4 import BeautifulSoup

# Setup logging
logger = setup_logger(__name__)

class RecipeExtractionService:
    """Unified service for extracting recipes from various URL sources"""
    
    def __init__(self):
        self.timeout = 30
        self.max_content_length = 1000000  # 1MB limit for web content
    
    async def extract_recipe_from_url(self, url: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Main entry point for recipe extraction from URLs
        Routes to appropriate extraction method based on URL type
        """
        try:
            if not url or not isinstance(url, str):
                return {"error": "Invalid URL provided"}
            
            url = url.strip()
            
            # Validate URL format
            if not self._is_valid_url(url):
                return {"error": "Invalid URL format. Please provide a valid HTTP/HTTPS URL."}
            
            logger.info(f"Processing URL: {url}")
            
            # Route to appropriate extraction service
            if validate_instagram_url(url):
                logger.info("Detected Instagram URL - routing to Instagram service")
                return await get_recipe_from_instagram(url, user_id)
            else:
                logger.info("Detected web URL - routing to web scraping service")
                return await self._extract_from_web_url(url, user_id)
                
        except Exception as e:
            logger.error(f"Error in recipe extraction service: {e}")
            return {"error": f"Failed to process URL: {str(e)}"}
    
    def _is_valid_url(self, url: str) -> bool:
        """Validate if the URL has a proper format"""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc]) and result.scheme in ['http', 'https']
        except Exception:
            return False
    
    async def _extract_from_web_url(self, url: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Extract recipe content from general web URLs"""
        try:
            # Fetch the webpage content
            html_content = await self._fetch_webpage_content(url)
            if not html_content:
                return {"error": "Failed to fetch webpage content or content is empty"}
            
            # Extract recipe content using multiple methods
            recipe_content = await self._extract_recipe_content_from_html(html_content, url)
            if not recipe_content:
                return {"error": "No recipe content found on the webpage"}
            
            logger.info(f"Extracted {len(recipe_content)} characters of content from web page")
            
            # Process with AI
            recipe_data = await process_with_ai(recipe_content)
            if not recipe_data:
                return {"error": "AI failed to extract recipe information from the content"}
            
            # Extract image URL from the webpage
            image_url = self._extract_main_image_url(html_content, url)
            
            # Save to database
            recipe_id = await save_recipe_to_db(recipe_data, url, image_url, user_id)
            if not recipe_id:
                return {"error": "Failed to save recipe to database"}
            
            logger.info(f"Successfully processed web recipe: {recipe_data.get('title')}")
            
            return {
                "success": True,
                "recipe_id": recipe_id,
                "source_url": url,
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
                "source": "web"
            }
            
        except Exception as e:
            logger.error(f"Error extracting from web URL: {e}")
            return {"error": f"Failed to extract recipe from webpage: {str(e)}"}
    
    async def _fetch_webpage_content(self, url: str) -> Optional[str]:
        """Fetch HTML content from a webpage with proper headers and error handling"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
            
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code != 200:
                    logger.warn(f"HTTP {response.status_code} error fetching {url}")
                    return None
                
                # Check content length
                if len(response.content) > self.max_content_length:
                    logger.warn(f"Content too large: {len(response.content)} bytes")
                    return None
                
                # Decode content
                return response.text
                
        except httpx.TimeoutException:
            logger.warn(f"Timeout fetching {url}")
            return None
        except Exception as e:
            logger.error(f"Error fetching webpage: {e}")
            return None
    
    async def _extract_recipe_content_from_html(self, html_content: str, url: str) -> Optional[str]:
        """Extract recipe content from HTML using multiple strategies"""
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Strategy 1: Look for JSON-LD structured data
            json_ld_content = self._extract_json_ld_recipe(soup)
            if json_ld_content:
                return json_ld_content
            
            # Strategy 2: Look for microdata recipe markup
            microdata_content = self._extract_microdata_recipe(soup)
            if microdata_content:
                return microdata_content
            
            # Strategy 3: Look for common recipe selectors
            selector_content = self._extract_recipe_by_selectors(soup)
            if selector_content:
                return selector_content
            
            # Strategy 4: Fallback to general content extraction
            general_content = self._extract_general_content(soup)
            if general_content and len(general_content) > 100:
                return general_content
            
            return None
            
        except Exception as e:
            logger.error(f"Error parsing HTML content: {e}")
            return None
    
    def _extract_json_ld_recipe(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract recipe from JSON-LD structured data"""
        try:
            import json
            
            # Find JSON-LD script tags
            json_scripts = soup.find_all('script', {'type': 'application/ld+json'})
            
            for script in json_scripts:
                try:
                    data = json.loads(script.string)
                    
                    # Handle single object or array
                    if isinstance(data, list):
                        data_items = data
                    else:
                        data_items = [data]
                    
                    for item in data_items:
                        if isinstance(item, dict) and item.get('@type') == 'Recipe':
                            return self._format_json_ld_recipe(item)
                            
                except json.JSONDecodeError:
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting JSON-LD: {e}")
            return None
    
    def _format_json_ld_recipe(self, recipe_data: dict) -> str:
        """Format JSON-LD recipe data into readable text"""
        try:
            content = []
            
            # Title
            if recipe_data.get('name'):
                content.append(f"# {recipe_data['name']}")
            
            # Description
            if recipe_data.get('description'):
                content.append(f"\n## Description\n{recipe_data['description']}")
            
            # Cook/Prep time
            if recipe_data.get('prepTime') or recipe_data.get('cookTime'):
                content.append("\n## Timing")
                if recipe_data.get('prepTime'):
                    content.append(f"Prep Time: {recipe_data['prepTime']}")
                if recipe_data.get('cookTime'):
                    content.append(f"Cook Time: {recipe_data['cookTime']}")
            
            # Servings
            if recipe_data.get('recipeYield'):
                content.append(f"Servings: {recipe_data['recipeYield']}")
            
            # Ingredients
            if recipe_data.get('recipeIngredient'):
                content.append("\n## Ingredients")
                for ingredient in recipe_data['recipeIngredient']:
                    content.append(f"- {ingredient}")
            
            # Instructions
            if recipe_data.get('recipeInstructions'):
                content.append("\n## Instructions")
                for i, instruction in enumerate(recipe_data['recipeInstructions'], 1):
                    if isinstance(instruction, dict):
                        text = instruction.get('text', str(instruction))
                    else:
                        text = str(instruction)
                    content.append(f"{i}. {text}")
            
            return '\n'.join(content)
            
        except Exception as e:
            logger.error(f"Error formatting JSON-LD recipe: {e}")
            return None
    
    def _extract_microdata_recipe(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract recipe from microdata markup"""
        try:
            # Look for recipe microdata
            recipe_elem = soup.find(attrs={'itemtype': re.compile(r'.*Recipe.*', re.I)})
            if not recipe_elem:
                return None
            
            content = []
            
            # Extract title
            title_elem = recipe_elem.find(attrs={'itemprop': 'name'})
            if title_elem:
                content.append(f"# {title_elem.get_text().strip()}")
            
            # Extract description
            desc_elem = recipe_elem.find(attrs={'itemprop': 'description'})
            if desc_elem:
                content.append(f"\n## Description\n{desc_elem.get_text().strip()}")
            
            # Extract ingredients
            ingredient_elems = recipe_elem.find_all(attrs={'itemprop': 'recipeIngredient'})
            if ingredient_elems:
                content.append("\n## Ingredients")
                for elem in ingredient_elems:
                    content.append(f"- {elem.get_text().strip()}")
            
            # Extract instructions
            instruction_elems = recipe_elem.find_all(attrs={'itemprop': 'recipeInstructions'})
            if instruction_elems:
                content.append("\n## Instructions")
                for i, elem in enumerate(instruction_elems, 1):
                    content.append(f"{i}. {elem.get_text().strip()}")
            
            return '\n'.join(content) if content else None
            
        except Exception as e:
            logger.error(f"Error extracting microdata: {e}")
            return None
    
    def _extract_recipe_by_selectors(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract recipe using common CSS selectors"""
        try:
            content = []
            
            # Common recipe selectors
            title_selectors = ['h1.recipe-title', '.recipe-header h1', '.recipe-title', 'h1']
            ingredient_selectors = ['.recipe-ingredients li', '.ingredients li', '.recipe-ingredient', '[class*="ingredient"]']
            instruction_selectors = ['.recipe-instructions li', '.instructions li', '.recipe-instruction', '[class*="instruction"]']
            
            # Extract title
            for selector in title_selectors:
                title_elem = soup.select_one(selector)
                if title_elem and title_elem.get_text().strip():
                    content.append(f"# {title_elem.get_text().strip()}")
                    break
            
            # Extract ingredients
            for selector in ingredient_selectors:
                ingredients = soup.select(selector)
                if ingredients and len(ingredients) > 2:  # At least 3 ingredients
                    content.append("\n## Ingredients")
                    for ing in ingredients[:20]:  # Limit to 20 ingredients
                        text = ing.get_text().strip()
                        if text and len(text) > 3:
                            content.append(f"- {text}")
                    break
            
            # Extract instructions
            for selector in instruction_selectors:
                instructions = soup.select(selector)
                if instructions and len(instructions) > 1:  # At least 2 steps
                    content.append("\n## Instructions")
                    for i, inst in enumerate(instructions[:15], 1):  # Limit to 15 steps
                        text = inst.get_text().strip()
                        if text and len(text) > 10:
                            content.append(f"{i}. {text}")
                    break
            
            return '\n'.join(content) if len(content) > 1 else None
            
        except Exception as e:
            logger.error(f"Error extracting by selectors: {e}")
            return None
    
    def _extract_general_content(self, soup: BeautifulSoup) -> Optional[str]:
        """Fallback general content extraction"""
        try:
            # Remove unwanted elements
            for elem in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
                elem.decompose()
            
            # Get main content areas
            main_selectors = ['main', '.main-content', '.content', 'article', '.recipe']
            
            for selector in main_selectors:
                main_elem = soup.select_one(selector)
                if main_elem:
                    text = main_elem.get_text(separator='\n', strip=True)
                    if len(text) > 200:
                        return text[:5000]  # Limit to 5000 characters
            
            # Fallback to body content
            body = soup.find('body')
            if body:
                text = body.get_text(separator='\n', strip=True)
                return text[:5000] if len(text) > 200 else None
            
            return None
            
        except Exception as e:
            logger.error(f"Error in general content extraction: {e}")
            return None
    
    def _extract_main_image_url(self, html_content: str, base_url: str) -> Optional[str]:
        """Extract the main recipe image URL from HTML"""
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Strategy 1: Look for recipe-specific image selectors
            image_selectors = [
                '.recipe-image img',
                '.recipe-photo img', 
                '.recipe img',
                '[class*="recipe"] img',
                'img[alt*="recipe" i]'
            ]
            
            for selector in image_selectors:
                img = soup.select_one(selector)
                if img and img.get('src'):
                    return self._resolve_image_url(img['src'], base_url)
            
            # Strategy 2: Look for Open Graph image
            og_image = soup.find('meta', property='og:image')
            if og_image and og_image.get('content'):
                return self._resolve_image_url(og_image['content'], base_url)
            
            # Strategy 3: Look for the first prominent image
            main_content = soup.select_one('main, article, .content, .recipe')
            if main_content:
                img = main_content.find('img')
                if img and img.get('src'):
                    return self._resolve_image_url(img['src'], base_url)
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting image URL: {e}")
            return None
    
    def _resolve_image_url(self, img_src: str, base_url: str) -> str:
        """Resolve relative image URLs to absolute URLs"""
        try:
            from urllib.parse import urljoin
            return urljoin(base_url, img_src)
        except Exception:
            return img_src

# Create a singleton instance
recipe_extraction_service = RecipeExtractionService()
