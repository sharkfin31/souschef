# SousChef API Server

A unified recipe extraction and management API that supports multiple URL types including Instagram posts, recipe websites, and general web content.

## Features

### 🍳 Recipe Extraction
- **Multi-source support**: Instagram posts, recipe websites, food blogs, general web content
- **Intelligent routing**: Automatically detects source type and applies appropriate extraction strategy
- **Multiple extraction methods**: JSON-LD, microdata, CSS selectors, and content-based extraction
- **Image OCR**: Extract recipes from uploaded images using Tesseract OCR
- **AI-powered parsing**: Enhanced recipe structuring using OpenRouter API

### 🔐 Authentication & Security
- **JWT token verification**: Secure user authentication with Supabase
- **Row Level Security**: User-specific data isolation in database
- **User management**: Complete user registration and authentication flow

### 📱 Grocery Lists
- **List sharing**: Share grocery lists via WhatsApp/SMS
- **Multiple formats**: Support for various messaging platforms
- **Batch operations**: Share multiple lists simultaneously

### 🎯 Well-Supported Recipe Sources
- AllRecipes.com
- Food Network
- Epicurious
- Bon Appétit
- Serious Eats
- Food.com
- And many more recipe websites

## Architecture

### Project Structure
```
server/
├── app.py                 # FastAPI application entry point
├── config.py             # Configuration and environment variables
├── requirements.txt      # Python dependencies
│
├── models/               # Pydantic data models
│   ├── __init__.py
│   └── schemas.py
│
├── routes/               # API route handlers
│   ├── __init__.py
│   ├── recipe_routes.py  # Recipe extraction and management
│   └── grocery_routes.py # Grocery list operations
│
├── services/             # Business logic services
│   ├── __init__.py
│   ├── ai_service.py           # AI-powered recipe processing
│   ├── auth_service.py         # JWT authentication
│   ├── db_service.py           # Database operations
│   ├── image_service.py        # Image OCR processing
│   ├── instagram_service.py    # Instagram content extraction
│   └── recipe_extraction_service.py  # Unified URL extraction
│
├── utils/                # Utilities and helpers
│   ├── __init__.py
│   ├── constants.py      # Application constants
│   └── helpers.py        # Utility functions
│
└── tests/                # Test files
    └── test_extraction_service.py
```

### Service Layer

#### RecipeExtractionService
Unified service for handling all URL-based recipe extraction:
- URL validation and routing
- Instagram URL detection and delegation
- Web scraping with multiple extraction strategies
- Content preprocessing for AI analysis

#### AuthService
JWT token verification and user management:
- Supabase JWT token extraction
- User ID verification from tokens
- Authentication middleware

#### DatabaseService
User-specific database operations:
- Recipe storage with user association
- User recipe retrieval
- Recipe metadata updates

## API Endpoints

### Recipe Operations

#### `POST /api/extract`
Extract recipe from URL (Instagram, recipe websites, general web content)

**Request:**
```json
{
  "url": "https://instagram.com/p/abc123/"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Recipe extracted successfully",
  "data": {
    "title": "Delicious Pasta Recipe",
    "description": "A simple and tasty pasta dish",
    "ingredients": [...],
    "instructions": [...],
    "cookTime": 30,
    "servings": 4
  }
}
```

#### `POST /api/extract-images`
Extract recipe from uploaded images using OCR

#### `GET /api/recipes`
Get user-specific recipes (requires authentication)

#### `GET /api/supported-domains`
Get list of well-supported recipe domains

### Grocery Operations

#### `POST /api/share-list`
Share grocery list via WhatsApp/SMS

#### `POST /api/share-multiple-lists`
Share multiple grocery lists

## Installation & Setup

### Prerequisites
- Python 3.8+
- Tesseract OCR (for image processing)
- Supabase account
- OpenRouter API key

### Environment Variables
Create a `.env` file in the server directory:

```env
# Required
OPENROUTER_API_KEY=your_openrouter_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# Optional - for grocery list sharing
WHATSAPP_API_KEY=your_whatsapp_api_key
WHATSAPP_PHONE_NUMBER=your_whatsapp_number
SENDER_EMAIL=your_sender_email
GATEWAY_ADDRESS=your_sms_gateway
APP_KEY=your_app_key

# Development
DEBUG=true
ENVIRONMENT=development
```

### Installation Steps

1. **Clone and navigate to server directory:**
   ```bash
   cd server
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv souschef_venv
   source souschef_venv/bin/activate  # On Windows: souschef_venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Install Tesseract OCR:**
   - **macOS:** `brew install tesseract`
   - **Ubuntu:** `sudo apt-get install tesseract-ocr`
   - **Windows:** Download from [GitHub releases](https://github.com/UB-Mannheim/tesseract/wiki)

5. **Set up Supabase database:**
   Run the migration SQL from `../supabase/migrations/20250725_add_recipe_user_policies.sql`

6. **Start the server:**
   ```bash
   python app.py
   ```

The API will be available at `http://localhost:8000` with interactive documentation at `http://localhost:8000/docs`.

## Development

### Code Style
- Use type hints for all function parameters and return values
- Follow PEP 8 styling guidelines
- Document all functions with docstrings
- Use logging instead of print statements

### Testing
```bash
python -m pytest tests/
```

### Adding New Extraction Sources
1. Add domain configuration to `utils/constants.py`
2. Implement extraction logic in `services/recipe_extraction_service.py`
3. Add tests in `tests/test_extraction_service.py`

## Deployment

### Production Considerations
- Set `ENVIRONMENT=production` in environment variables
- Configure proper CORS origins in `app.py`
- Use a production WSGI server like Gunicorn
- Set up proper logging and monitoring
- Secure environment variable management

### Docker Deployment (Optional)
```dockerfile
FROM python:3.11-slim

# Install Tesseract
RUN apt-get update && apt-get install -y tesseract-ocr

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "app.py"]
```

## Troubleshooting

### Common Issues

1. **Tesseract not found:**
   - Ensure Tesseract is installed and in PATH
   - On deployment platforms, verify Tesseract availability

2. **Supabase authentication errors:**
   - Verify JWT secret is correct
   - Check Supabase project settings

3. **Import errors:**
   - Ensure virtual environment is activated
   - Verify all dependencies are installed

### Logging
The application uses structured logging. Check logs for detailed error information and debugging context.

## Contributing

1. Follow the existing code structure and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Use the utilities and constants from the utils module

## License

MIT License - see LICENSE file for details.
