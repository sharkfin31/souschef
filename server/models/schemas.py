from pydantic import BaseModel
from typing import Optional, List

class InstagramURL(BaseModel):
    url: str

class IngredientSchema(BaseModel):
    name: str
    quantity: Optional[str] = None
    unit: Optional[str] = None

class InstructionSchema(BaseModel):
    stepNumber: int
    description: str

class RecipeSchema(BaseModel):
    title: str
    description: Optional[str] = None
    ingredients: List[IngredientSchema]
    instructions: List[InstructionSchema]
    prepTime: Optional[int] = None
    cookTime: Optional[int] = None
    servings: Optional[int] = None