import httpx
import re
import json
from typing import Optional, Dict, Any
from config import OPENROUTER_API_KEY
from utils.helpers import setup_logger

# Setup logging
logger = setup_logger(__name__)

async def process_with_ai(content: str) -> Optional[Dict[str, Any]]:
    """Process recipe content with OpenRouter AI to extract structured recipe data"""
    prompt = f"""
You are an expert recipe analyzer. Extract and structure recipe information from the provided content.

IMPORTANT INSTRUCTIONS:
- If content contains multiple images, they are in sequential order (ingredients first, then instructions)
- For missing timing information, make educated estimates based on cooking methods and ingredients
- Always provide realistic time estimates even if not explicitly stated
- Use standard cooking time guidelines for common dishes and techniques
- For ingredient quantities: Convert ranges to single values (e.g., "1-2 cups" becomes "1.5", "7-8 items" becomes "7")
- Ensure all numeric fields (prepTime, cookTime, totalTime, servings, stepNumber, timeEstimate) are integers
- Ingredient quantities should be strings representing single numeric values
- SERVINGS RULE: ONLY use the exact number if explicitly stated in the recipe. If no serving size is mentioned anywhere in the content, you MUST set servings to 2. Do not estimate or infer servings from ingredient quantities.

Return ONLY a valid JSON object with this EXACT structure:
{{
  "title": "Clear, descriptive recipe title",
  "description": "Brief 1-2 sentence description highlighting key features",
  "prepTime": <number>, // Preparation time in minutes (estimate if not provided)
  "cookTime": <number>, // Cooking time in minutes (estimate if not provided)
  "totalTime": <number>, // Total time in minutes (prepTime + cookTime)
  "servings": <number>, // EXACTLY 2 if not explicitly stated in recipe, otherwise use stated number
  "difficulty": "Easy|Medium|Hard", // Based on techniques and ingredient complexity
  "ingredients": [
    {{
      "name": "ingredient name (standardized, no brand names)",
      "quantity": "single numeric value as string", // e.g., "1", "0.5", "2" (convert ranges like "1-2" to middle value "1.5")
      "unit": "standard unit" // "cup", "tbsp", "tsp", "g", "kg", "ml", "l", "oz", "lb", null for items
    }}
  ],
  "instructions": [
    {{
      "stepNumber": 1,
      "description": "Clear, actionable step description",
      "timeEstimate": <number|null> // Minutes for this step if applicable
    }}
  ],
  "tags": ["cuisine", "dietary_restrictions", "meal_type", "cooking_method", "season", "difficulty"],
  "nutritionNotes": "Brief notes about nutrition highlights or dietary considerations"
}}

TIME ESTIMATION GUIDELINES:
- Prep: Chopping, mixing, marinating - typically 10-30 minutes
- Baking: Cookies 10-15min, cakes 25-45min, bread 30-60min
- Stovetop: Sautéing 5-15min, simmering 20-60min, boiling 10-20min
- Grilling: 10-30 minutes depending on protein
- Roasting: Vegetables 20-45min, chicken 45-90min, beef varies by cut

DIFFICULTY ASSESSMENT:
- Easy: Basic techniques, common ingredients, minimal steps
- Medium: Some advanced techniques, timing coordination, special ingredients
- Hard: Complex techniques, precise timing, professional skills needed

TAG CATEGORIES (choose relevant ones):
- Cuisine: Italian, Mexican, Asian, Mediterranean, American, etc.
- Dietary: Vegetarian, Vegan, Gluten-Free, Dairy-Free, Keto, Paleo, etc.
- Meal: Breakfast, Lunch, Dinner, Snack, Dessert, Appetizer, Side
- Method: Baked, Grilled, Fried, Roasted, Steamed, Raw, No-Cook
- Season: Spring, Summer, Fall, Winter
- Special: Quick, Make-Ahead, One-Pot, Holiday, Comfort-Food

Content to analyze:
{content}

CRITICAL REMINDER: For the "servings" field, scan the entire content for explicit serving information like "serves 4", "makes 6 portions", "feeds 8 people", etc. If NO such explicit serving information exists anywhere in the content, you MUST use exactly 2. Do not estimate based on ingredient quantities or recipe size.

Return ONLY the JSON object with no additional text, explanations, or formatting.
"""

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://souschef.app",
                    "X-Title": "SousChef Recipe Extractor"
                },
                json={
                    "model": "anthropic/claude-3-haiku",
                    "messages": [
                        {
                            "role": "user", 
                            "content": prompt
                        }
                    ],
                    "temperature": 0.1,
                    "max_tokens": 4000
                },
                timeout=45.0
            )
            
            if response.status_code != 200:
                logger.error(f"API Error: {response.status_code} - {response.text}")
                return None
                
            result = response.json()
            ai_response = result["choices"][0]["message"]["content"]
            
            # Extract JSON from response with better error handling
            json_match = re.search(r'({[\s\S]*})', ai_response.strip())
            if json_match:
                try:
                    parsed_data = json.loads(json_match.group(1))
                    
                    # Safety check: Ensure servings defaults to 2 if not reasonable
                    if 'servings' not in parsed_data or not isinstance(parsed_data['servings'], int) or parsed_data['servings'] <= 0:
                        logger.warning(f"Invalid or missing servings value, defaulting to 2")
                        parsed_data['servings'] = 2
                    
                    return parsed_data
                    
                except json.JSONDecodeError as e:
                    logger.error(f"JSON parsing error: {e}")
                    logger.debug(f"Raw response: {ai_response}")
                    return None
            else:
                logger.error(f"No JSON found in response: {ai_response[:200]}...")
                return None
                
    except httpx.TimeoutException:
        logger.error("AI processing timeout")
        return None
    except Exception as e:
        logger.error(f"AI processing error: {e}")
        return None