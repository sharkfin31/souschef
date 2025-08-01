from fastapi import HTTPException, Header
from typing import Optional
from config import supabase
from utils.helpers import setup_logger

# Setup logging
logger = setup_logger(__name__)

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Extract user ID from Authorization header"""
    if not authorization:
        return None
    
    try:
        # Extract bearer token
        if not authorization.startswith("Bearer "):
            return None
        
        token = authorization.split(" ")[1]
        
        # Use Supabase to verify the JWT token
        try:
            # Get user from token using Supabase client
            user_response = supabase.auth.get_user(token)
            if user_response and hasattr(user_response, 'user') and user_response.user:
                return user_response.user.id
        except Exception as e:
            logger.warn(f"Token verification failed: {e}")
            # Alternative method - try to verify the token manually
            try:
                import jwt
                import os
                from jwt import PyJWTError
                
                # Get JWT secret from Supabase (this would be your JWT secret)
                jwt_secret = os.getenv('SUPABASE_JWT_SECRET')
                if jwt_secret:
                    decoded = jwt.decode(token, jwt_secret, algorithms=['HS256'])
                    return decoded.get('sub')  # 'sub' contains the user ID
            except (PyJWTError, ImportError):
                pass
            
            return None
        
        return None
        
    except Exception as e:
        logger.error(f"Error extracting user from token: {e}")
        return None
