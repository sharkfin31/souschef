from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional
import os
import requests
import urllib
import smtplib
from email.message import EmailMessage
from config import senderEmail, gatewayAddress, APP_KEY
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

router = APIRouter(prefix="/api", tags=["grocery"])

# Get WhatsApp API key from environment variables
WHATSAPP_API_KEY = os.getenv("WHATSAPP_API_KEY")
WHATSAPP_PHONE_NUMBER = os.getenv("WHATSAPP_PHONE_NUMBER")

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

class ListToShare(BaseModel):
    listId: str
    listName: str
    items: List[GroceryItem]
    
class ShareMultipleListsRequest(BaseModel):
    lists: List[ListToShare]
    phoneNumber: Optional[str] = None

@router.post("/share-list")
async def share_grocery_list(request: ShareListRequest = Body(...)):
    """
    Share a grocery list via WhatsApp/SMS
    """
    try:
        # Format the grocery list as text
        message = f"🛒 *{request.listName}*\n\n"
        incomplete_items = [item for item in request.items if not item.completed]
        
        # Add incomplete items first
        if incomplete_items:
            message += "*Items to buy:*\n"
            for item in incomplete_items:
                quantity_text = f" - {item.quantity}" if item.quantity else ""
                unit_text = f" {item.unit}" if item.unit else ""
                message += f"• {item.name.capitalize()}{quantity_text}{unit_text}\n"
        
        whatsapp_apikey = os.getenv("WHATSAPP_API_KEY")
        if not whatsapp_apikey:
            raise HTTPException(status_code=500, detail="CallMeBot API key not configured")

        # Ensure phone number is provided
        phone_number = request.phoneNumber or os.getenv("WHATSAPP_PHONE_NUMBER")
        if not phone_number:
            raise HTTPException(status_code=400, detail="Phone number is required")

        # URL encode the message in UTF-8
        encoded_message = urllib.parse.quote(message.encode('utf-8'))

        # Build the API URL
        api_url = (
            f"https://api.callmebot.com/whatsapp.php?"
            f"phone={phone_number}&text={encoded_message}&apikey={whatsapp_apikey}"
        )

        # Send the WhatsApp message
        response = requests.get(api_url)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Failed to send WhatsApp message: {response.text}")

        return {"success": True, "message": "Grocery list shared via WhatsApp"}
        
        # # If we have an SMS gateway configured, send the message via email
        # if senderEmail and gatewayAddress and APP_KEY:
        #     msg = EmailMessage()
        #     msg.set_content(message)
        #     msg['Subject'] = f"Grocery List: {request.listName}"
        #     msg['From'] = senderEmail
        #     msg['To'] = f"{request.phoneNumber}@{gatewayAddress}"
            
        #     server = smtplib.SMTP('smtp.gmail.com', 587)
        #     server.starttls()
        #     server.login(senderEmail, APP_KEY)
        #     server.send_message(msg)
        #     server.quit()
        # return {"success": True, "message": "Grocery list shared successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to share grocery list: {str(e)}")
        
@router.post("/share-multiple-lists")
async def share_multiple_grocery_lists(request: ShareMultipleListsRequest = Body(...)):
    """
    Share multiple grocery lists via WhatsApp/SMS
    """
    try:
        # Format the grocery lists as text
        message = "🛒 *Your Grocery Lists*\n\n"
        
        for list_data in request.lists:
            message += f"*{list_data.listName}*\n"
            incomplete_items = [item for item in list_data.items if not item.completed]
            
            # Add incomplete items
            if incomplete_items:
                message += "Items to buy:\n"
                for item in incomplete_items:
                    quantity_text = f" - {item.quantity}" if item.quantity else ""
                    unit_text = f" {item.unit}" if item.unit else ""
                    message += f"• {item.name.capitalize()}{quantity_text}{unit_text}\n"
            
            message += "\n"  # Add spacing between lists
        
        whatsapp_apikey = os.getenv("WHATSAPP_API_KEY")
        if not whatsapp_apikey:
            raise HTTPException(status_code=500, detail="CallMeBot API key not configured")

        # Ensure phone number is provided
        phone_number = request.phoneNumber or os.getenv("WHATSAPP_PHONE_NUMBER")
        if not phone_number:
            raise HTTPException(status_code=400, detail="Phone number is required")

        # URL encode the message in UTF-8
        encoded_message = urllib.parse.quote(message.encode('utf-8'))

        # Build the API URL
        api_url = (
            f"https://api.callmebot.com/whatsapp.php?"
            f"phone={phone_number}&text={encoded_message}&apikey={whatsapp_apikey}"
        )

        # Send the WhatsApp message
        response = requests.get(api_url)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Failed to send WhatsApp message: {response.text}")

        return {"success": True, "message": "Grocery lists shared via WhatsApp"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to share grocery lists: {str(e)}")