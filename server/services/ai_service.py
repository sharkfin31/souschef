import httpx
import re
import json
from config import OPENROUTER_API_KEY

async def process_with_ai(content: str):
    """Process recipe content with OpenRouter AI"""
    prompt = f"""
Extract the recipe details from the following content.

IMPORTANT: If the content contains multiple images, they are presented in sequential order. 
The first image might contain ingredients, and subsequent images might contain instructions.
Make sure to process them in the order provided and combine the information correctly.

Return ONLY a JSON object with the following structure:
{{
  "title": "Recipe title",
  "description": "Brief description of the recipe",
  "ingredients": [
    {{
      "name": "ingredient name",
      "quantity": "amount", // IMPORTANT: Use numeric values (e.g., 1, 0.5, 1.5) without units
      "unit": "measurement unit" // Put units here (e.g., "cup", "tbsp", "g")
    }}
  ],
  "instructions": [
    {{
      "stepNumber": 1,
      "description": "step description"
    }}
  ],
  "tags": ["cuisine type", "vegetarian/non-vegetarian", "meal type", "difficulty", "cooking method"]
}}

Here's the content to parse:
{content}

Remember to return ONLY the JSON object with no additional text or explanations.
"""

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://souschef.app"
                },
                json={
                    "model": "anthropic/claude-3-haiku",
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.1
                },
                timeout=30.0
            )
            
            result = response.json()
            ai_response = result["choices"][0]["message"]["content"]
            
            # Extract JSON from response
            json_match = re.search(r'({[\s\S]*})', ai_response)
            if json_match:
                parsed_data = json.loads(json_match.group(1))
                return parsed_data
            else:
                return None
    except Exception as e:
        print(f"AI processing error: {e}")
        return None