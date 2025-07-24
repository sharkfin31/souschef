# SousChef

SousChef is a recipe management web application that allows you to save and organize recipes from around the web. It can parse recipes from websites and Instagram posts using AI, making it easy to collect and store your favorite recipes in one place.

## Features

- Parse recipes from website URLs using AI
- Parse recipes from Instagram posts
- Extract recipes from images using OCR
- Save recipes to your collection
- View detailed recipe information including ingredients and instructions
- Create grocery lists from recipe ingredients
- Responsive design for mobile and desktop

## Tech Stack

### Frontend
- **Framework**: React, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase

### Backend
- **Framework**: FastAPI (Python)
- **AI Integration**: OpenRouter API (Claude 3)
- **Image Processing**: Tesseract OCR
- **Database**: Supabase

### Deployment
- **Frontend**: Vercel
- **Backend**: Render

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Python 3.9 or higher
- Supabase account
- OpenRouter API key
- Tesseract OCR installed

### Installation

#### Frontend

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/souschef.git
   cd souschef
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_API_URL=http://localhost:8000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

#### Backend

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Install Tesseract OCR:
   - **macOS**: `brew install tesseract`
   - **Linux**: `sudo apt-get install tesseract-ocr`
   - **Windows**: Download from [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki)

4. Create a `.env` file based on `.env.example`:
   ```
   INSTAGRAM_USERNAME=your_instagram_username
   INSTAGRAM_PASSWORD=your_instagram_password
   OPENROUTER_API_KEY=your_openrouter_api_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_service_key
   ```

5. Start the backend server:
   ```bash
   uvicorn app:app --reload
   ```

## Deployment

### Frontend (Vercel)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Backend (Render)

1. Push your code to GitHub
2. Create a new Web Service on Render
3. Connect your repository
4. Set the build command: `pip install -r server/requirements.txt`
5. Set the start command: `cd server && uvicorn app:app --host 0.0.0.0 --port $PORT`
6. Add environment variables
7. Deploy!

## License

This project is licensed under the MIT License - see the LICENSE file for details.