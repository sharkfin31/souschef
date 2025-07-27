"""
Utility functions for SousChef API
"""

import logging
from typing import Optional, Any, Dict
from urllib.parse import urlparse

def setup_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """Setup a logger with consistent formatting"""
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(level)
    
    return logger

def is_valid_url(url: str) -> bool:
    """Validate if a string is a valid URL"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False

def extract_domain(url: str) -> Optional[str]:
    """Extract domain from URL"""
    try:
        parsed = urlparse(url)
        return parsed.netloc.lower()
    except Exception:
        return None

def format_error_response(message: str, status_code: int, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Format a consistent error response"""
    response = {
        "error": True,
        "message": message,
        "status_code": status_code
    }
    
    if details:
        response["details"] = details
    
    return response

def format_success_response(data: Any, message: str = "Success") -> Dict[str, Any]:
    """Format a consistent success response"""
    return {
        "success": True,
        "message": message,
        "data": data
    }
