"""
Grocery Routes - API endpoints for grocery list management and sharing

This module handles grocery list operations including:
- Sharing grocery lists via WhatsApp/SMS
- Formatting lists for different messaging platforms
- Multiple list sharing functionality
"""

from fastapi import APIRouter, HTTPException, Body, Header
from pydantic import BaseModel
from typing import List, Optional
import os
import requests
import urllib
from dotenv import load_dotenv

# Local imports
from utils.constants import Messages, StatusCodes
from utils.helpers import setup_logger, format_error_response, format_success_response
from services.db_service import get_user_profile
from services.auth_service import get_current_user

# Load environment variables
load_dotenv()

# Setup logging
logger = setup_logger(__name__)

router = APIRouter(prefix="/api", tags=["grocery"])

class GroceryItem(BaseModel):
    """Model for individual grocery list items"""
    id: Optional[str] = None
    name: str
    quantity: Optional[str] = None
    unit: Optional[str] = None
    completed: bool = False
    recipeTitle: Optional[str] = None

class ShareListRequest(BaseModel):
    """Model for sharing a single grocery list"""
    listId: str
    listName: str
    items: List[GroceryItem]
    phoneNumber: Optional[str] = None

class ListToShare(BaseModel):
    """Model for lists in multi-list sharing"""
    listId: str
    listName: str
    items: List[GroceryItem]
    
class ShareMultipleListsRequest(BaseModel):
    """Model for sharing multiple grocery lists"""
    lists: List[ListToShare]
    phoneNumber: Optional[str] = None

@router.post("/share-list")
async def share_grocery_list(request: ShareListRequest = Body(...), authorization: Optional[str] = Header(None)):
    """
    Share a grocery list via WhatsApp/SMS
    
    Formats and sends a grocery list to the specified phone number
    using available messaging services (WhatsApp API or SMS gateway).
    """
    try:
        logger.info(f"Sharing grocery list '{request.listName}' - phoneNumber from request: {request.phoneNumber}")
        
        # Get current user
        user_id = await get_current_user(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required to share grocery lists")

        # Get user profile to fetch WhatsApp API key (with auth context)
        auth_token = authorization.split(" ")[1] if authorization and authorization.startswith("Bearer ") else None
        user_profile = await get_user_profile(user_id, auth_token)
        if not user_profile:
            raise HTTPException(status_code=404, detail="User profile not found")

        whatsapp_apikey = user_profile.get('whatsapp_api_key')
        if not whatsapp_apikey:
            raise HTTPException(
                status_code=400, 
                detail="WhatsApp API key not configured in your profile. Please update your profile settings."
            )

        # Use user's phone number if no phone number provided in request
        phone_number = request.phoneNumber
        if not phone_number:
            phone_number = user_profile.get('phone_number')
        
        if not phone_number:
            raise HTTPException(
                status_code=400, 
                detail="Phone number is required. Please provide a phone number or update your profile."
            )

        logger.info(f"Using phone number: {phone_number}")

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
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to share grocery list: {str(e)}")
        
@router.post("/share-multiple-lists")
async def share_multiple_grocery_lists(request: ShareMultipleListsRequest = Body(...), authorization: Optional[str] = Header(None)):
    """
    Share multiple grocery lists via WhatsApp/SMS
    """
    try:
        logger.info(f"Sharing multiple grocery lists - phoneNumber from request: {request.phoneNumber}")
        
        # Get current user
        user_id = await get_current_user(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required to share grocery lists")

        # Get user profile to fetch WhatsApp API key (with auth context)
        auth_token = authorization.split(" ")[1] if authorization and authorization.startswith("Bearer ") else None
        user_profile = await get_user_profile(user_id, auth_token)
        if not user_profile:
            raise HTTPException(status_code=404, detail="User profile not found")

        whatsapp_apikey = user_profile.get('whatsapp_api_key')
        if not whatsapp_apikey:
            raise HTTPException(
                status_code=400, 
                detail="WhatsApp API key not configured in your profile. Please update your profile settings."
            )

        # Use user's phone number if no phone number provided in request
        phone_number = request.phoneNumber
        if not phone_number:
            phone_number = user_profile.get('phone_number')
        
        if not phone_number:
            raise HTTPException(
                status_code=400, 
                detail="Phone number is required. Please provide a phone number or update your profile."
            )

        logger.info(f"Using phone number for multiple lists: {phone_number}")
        
        # Format the grocery lists as text
        message = "🛒 *Your Grocery Lists*\n\n"
        
        for i, list_data in enumerate(request.lists):
            message += f"*{list_data.listName}*\n"
            incomplete_items = [item for item in list_data.items if not item.completed]
            
            # Add incomplete items
            if incomplete_items:
                message += "Items to buy:\n"
                for item in incomplete_items:
                    quantity_text = f" - {item.quantity}" if item.quantity else ""
                    unit_text = f" {item.unit}" if item.unit else ""
                    message += f"• {item.name.capitalize()}{quantity_text}{unit_text}\n"
            
            # Only add spacing between lists, not after the last one
            if i < len(request.lists) - 1:
                message += "\n"

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