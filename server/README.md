# SousChef Content Extraction Backend

This is a Python backend service for extracting content from websites and Instagram posts using Selenium and BeautifulSoup.

## Setup

1. Install Python 3.8 or higher
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Install Chrome browser (required for Selenium)
4. Install ChromeDriver (compatible with your Chrome version)

## Running the server

```
python extract.py
```

The server will run on http://localhost:5000

## API Endpoints

### POST /extract

Extracts content from a URL.

**Request Body:**
```json
{
  "url": "https://example.com/recipe"
}
```

**Response:**
```json
{
  "success": true,
  "content": {
    "title": "Recipe Title",
    "content": "Extracted content...",
    "structuredData": "JSON-LD data if available",
    "source": "https://example.com/recipe"
  }
}
```

For Instagram URLs, the response will include:
```json
{
  "success": true,
  "content": {
    "caption": "Post caption",
    "username": "Instagram username",
    "imageUrl": "URL to post image",
    "source": "https://instagram.com/..."
  }
}
```