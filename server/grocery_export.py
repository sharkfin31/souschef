from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional
import os
import requests
import smtplib
from email.message import EmailMessage
from config import senderEmail, gatewayAddress, APP_KEY
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

phone_number = "3234235099"

router = APIRouter()

class GroceryItem(BaseModel):
    id: Optional[str] = None
    name: str
    quantity: Optional[str] = None
    unit: Optional[str] = None
    completed: bool = False
    recipeTitle: Optional[str] = None

class ShareListRequest(BaseModel):
    listId: str
    listName: str
    items: List[GroceryItem]
    phoneNumber: Optional[str] = None
    

@router.post('/api/export-grocery-lists')
async def export_grocery_lists():
    if senderEmail and gatewayAddress and APP_KEY:
        msg = EmailMessage()
        msg.set_content("Hello, here is your grocery list export:\n\n")
        msg['Subject'] = f"Grocery List: Master list"
        msg['From'] = senderEmail
        msg['To'] = f"{phone_number}@{gatewayAddress}"
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(senderEmail, APP_KEY)
        server.send_message(msg)
        server.quit()
    return {"success": True, "message": "Grocery list shared successfully"}