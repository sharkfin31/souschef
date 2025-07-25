"""
Configuration module for SousChef API

Centralizes all environment variables, API keys, and application settings.
Provides configuration validation and initialization.
"""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env file
load_dotenv()

class Config:
    """Configuration class for application settings"""
    
    # API Keys and External Services
    OPENROUTER_API_KEY: str = os.getenv('OPENROUTER_API_KEY', '')
    SUPABASE_URL: str = os.getenv('SUPABASE_URL', '')
    SUPABASE_KEY: str = os.getenv('SUPABASE_KEY', '')
    SUPABASE_JWT_SECRET: str = os.getenv('SUPABASE_JWT_SECRET', '')
    
    # Messaging Services
    WHATSAPP_API_KEY: str = os.getenv('WHATSAPP_API_KEY', '')
    WHATSAPP_PHONE_NUMBER: str = os.getenv('WHATSAPP_PHONE_NUMBER', '')
    SENDER_EMAIL: str = os.getenv('SENDER_EMAIL', '')
    GATEWAY_ADDRESS: str = os.getenv('GATEWAY_ADDRESS', '')
    APP_KEY: str = os.getenv('APP_KEY', '')
    
    # Application Settings
    UPLOAD_DIR: str = "uploads"
    DEBUG: bool = os.getenv('DEBUG', 'False').lower() == 'true'
    ENVIRONMENT: str = os.getenv('ENVIRONMENT', 'development')
    
    # Server Configuration
    HOST: str = os.getenv('HOST', '0.0.0.0')
    PORT: int = int(os.getenv('PORT', 8000))
    
    @classmethod
    def validate_required_config(cls) -> list[str]:
        """Validate that required configuration is present"""
        missing = []
        
        required_keys = [
            'OPENROUTER_API_KEY',
            'SUPABASE_URL', 
            'SUPABASE_KEY',
            'SUPABASE_JWT_SECRET'
        ]
        
        for key in required_keys:
            if not getattr(cls, key):
                missing.append(key)
        
        return missing
    
    @classmethod
    def initialize_directories(cls) -> None:
        """Create necessary directories"""
        Path(cls.UPLOAD_DIR).mkdir(exist_ok=True)

# Initialize configuration
config = Config()

# Create upload directory
config.initialize_directories()

# Validate required configuration
missing_config = config.validate_required_config()
if missing_config and config.ENVIRONMENT == 'production':
    raise ValueError(f"Missing required configuration: {', '.join(missing_config)}")

# Initialize Supabase client
supabase: Optional[Client] = None
if config.SUPABASE_URL and config.SUPABASE_KEY:
    supabase = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)

# Export commonly used values for backward compatibility
OPENROUTER_API_KEY = config.OPENROUTER_API_KEY
SUPABASE_URL = config.SUPABASE_URL
SUPABASE_KEY = config.SUPABASE_KEY
SUPABASE_JWT_SECRET = config.SUPABASE_JWT_SECRET
UPLOAD_DIR = config.UPLOAD_DIR

# Messaging configuration (for grocery routes)
senderEmail = config.SENDER_EMAIL
gatewayAddress = config.GATEWAY_ADDRESS
APP_KEY = config.APP_KEY