import httpx
import re
import json
from typing import Optional, Dict, Any
from config import OPENROUTER_API_KEY

async def process_with_ai(content: str) -> Optional[Dict[str, Any]]:
    """Process recipe content with OpenRouter AI to extract structured recipe data"""
    prompt = f"""
You are an expert recipe analyzer. Extract and structure recipe information from the provided content.

IMPORTANT INSTRUCTIONS:
- If content contains multiple images, they are in sequential order (ingredients first, then instructions)
- For missing timing information, make educated estimates based on cooking methods and ingredients
- Always provide realistic time estimates even if not explicitly stated
- Use standard cooking time guidelines for common dishes and techniques

Return ONLY a valid JSON object with this EXACT structure:
{{
  "title": "Clear, descriptive recipe title",
  "description": "Brief 1-2 sentence description highlighting key features",
  "prepTime": <number>, // Preparation time in minutes (estimate if not provided)
  "cookTime": <number>, // Cooking time in minutes (estimate if not provided)
  "totalTime": <number>, // Total time in minutes (prepTime + cookTime)
  "servings": <number>, // Number of servings (estimate 4 if not specified)
  "difficulty": "Easy|Medium|Hard", // Based on techniques and ingredient complexity
  "ingredients": [
    {{
      "name": "ingredient name (standardized, no brand names)",
      "quantity": "numeric value or range", // e.g., "1", "0.5", "1-2"
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
  "nutritionNotes": "Brief notes about nutrition highlights or dietary considerations",
  "tips": ["cooking tip 1", "cooking tip 2"] // Max 3 practical tips
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
                print(f"API Error: {response.status_code} - {response.text}")
                return None
                
            result = response.json()
            ai_response = result["choices"][0]["message"]["content"]
            
            # Extract JSON from response with better error handling
            json_match = re.search(r'({[\s\S]*})', ai_response.strip())
            if json_match:
                try:
                    parsed_data = json.loads(json_match.group(1))
                    
                    # Validate required fields and add defaults
                    validated_data = _validate_and_enhance_recipe_data(parsed_data)
                    return validated_data
                    
                except json.JSONDecodeError as e:
                    print(f"JSON parsing error: {e}")
                    print(f"Raw response: {ai_response}")
                    return None
            else:
                print(f"No JSON found in response: {ai_response}")
                return None
                
    except httpx.TimeoutException:
        print("AI processing timeout")
        return None
    except Exception as e:
        print(f"AI processing error: {e}")
        return None


def _validate_and_enhance_recipe_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and enhance recipe data with defaults and corrections"""
    
    # Ensure required fields exist with defaults
    validated = {
        "title": data.get("title", "Untitled Recipe").strip(),
        "description": data.get("description", "A delicious recipe").strip(),
        "prepTime": _ensure_positive_int(data.get("prepTime"), 15),
        "cookTime": _ensure_positive_int(data.get("cookTime"), 20),
        "servings": _ensure_positive_int(data.get("servings"), 4),
        "difficulty": data.get("difficulty", "Medium") if data.get("difficulty") in ["Easy", "Medium", "Hard"] else "Medium",
        "ingredients": _validate_ingredients(data.get("ingredients", [])),
        "instructions": _validate_instructions(data.get("instructions", [])),
        "tags": _validate_tags(data.get("tags", [])),
        "nutritionNotes": data.get("nutritionNotes", "").strip(),
        "tips": data.get("tips", [])[:3] if isinstance(data.get("tips"), list) else []
    }
    
    # Calculate total time
    validated["totalTime"] = validated["prepTime"] + validated["cookTime"]
    
    return validated


def _ensure_positive_int(value: Any, default: int) -> int:
    """Ensure a value is a positive integer, return default if not"""
    try:
        num = int(float(value)) if value is not None else default
        return max(1, num)
    except (ValueError, TypeError):
        return default


def _validate_ingredients(ingredients: list) -> list:
    """Validate and clean ingredient list"""
    validated = []
    for ingredient in ingredients:
        if isinstance(ingredient, dict) and ingredient.get("name"):
            validated.append({
                "name": ingredient.get("name", "").strip(),
                "quantity": str(ingredient.get("quantity", "")).strip() or "1",
                "unit": ingredient.get("unit", "").strip() or None
            })
    return validated


def _validate_instructions(instructions: list) -> list:
    """Validate and clean instruction list"""
    validated = []
    for i, instruction in enumerate(instructions):
        if isinstance(instruction, dict) and instruction.get("description"):
            step_number = instruction.get("stepNumber", i + 1)
            time_estimate = instruction.get("timeEstimate")
            
            validated.append({
                "stepNumber": _ensure_positive_int(step_number, i + 1),
                "description": instruction.get("description", "").strip(),
                "timeEstimate": _ensure_positive_int(time_estimate, None) if time_estimate else None
            })
    return validated


def _validate_tags(tags: list) -> list:
    """Validate and clean tags list"""
    if not isinstance(tags, list):
        return []
    
    # Clean and deduplicate tags
    validated = []
    seen = set()
    
    for tag in tags:
        if isinstance(tag, str):
            clean_tag = tag.strip().title()
            if clean_tag and clean_tag not in seen and len(clean_tag) <= 50:
                validated.append(clean_tag)
                seen.add(clean_tag)
    
    return validated[:10]  # Limit to 10 tags