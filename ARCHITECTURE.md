# SousChef Architecture

This document outlines the architecture of the SousChef application, which consists of a React frontend and a FastAPI backend.

## Backend Architecture

The backend is built with FastAPI and follows a modular structure:

```
server/
├── models/          # Data models and schemas
├── routes/          # API endpoints
├── services/        # Business logic
├── utils/           # Helper functions
├── app.py           # Main application entry point
└── config.py        # Configuration settings
```

### Key Components

- **Models**: Pydantic models for request/response validation
- **Routes**: API endpoints organized by feature
- **Services**: Business logic separated by domain
  - `ai_service.py`: AI processing with OpenRouter
  - `db_service.py`: Database operations with Supabase
  - `instagram_service.py`: Instagram data extraction
  - `image_service.py`: Image processing with OCR

## Frontend Architecture

The frontend is built with React and follows a modular structure:

```
src/
├── assets/          # Static assets
├── components/      # Reusable UI components
├── hooks/           # Custom React hooks
├── lib/             # Library integrations
├── pages/           # Page components
├── services/        # API and data services
│   ├── api/         # API client and endpoints
│   ├── grocery/     # Grocery list services
│   └── recipe/      # Recipe services
├── types/           # TypeScript type definitions
└── utils/           # Helper functions
```

### Key Components

- **Services**: Organized by domain
  - `api/`: API client and endpoints for backend communication
  - `grocery/`: Grocery list data management
  - `recipe/`: Recipe data management
- **Components**: Reusable UI components
- **Pages**: Top-level page components

## Data Flow

1. User interacts with the frontend UI
2. Frontend services make API calls to the backend
3. Backend routes handle the requests
4. Backend services process the data (AI, database, etc.)
5. Response is returned to the frontend
6. Frontend updates the UI with the data

## Key Features

- Recipe extraction from Instagram posts
- Recipe extraction from images using OCR
- AI-powered recipe parsing
- Recipe storage and retrieval
- Grocery list creation and management