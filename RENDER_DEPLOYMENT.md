# Deploying SousChef to Render

This guide explains how to deploy the SousChef application to Render.

## Prerequisites

- A Render account (https://render.com)
- Your code pushed to a Git repository (GitHub, GitLab, etc.)

## Deployment Steps

### 1. Connect Your Repository to Render

1. Log in to your Render account
2. Click on "New" and select "Web Service"
3. Connect your Git repository
4. Select the repository containing your SousChef application

### 2. Configure the Web Service

Render will automatically detect the `render.yaml` file in your repository and use its configuration. However, you can also manually configure the service:

- **Name**: souschef-api
- **Environment**: Python
- **Build Command**: 
  ```
  pip install -r server/requirements.txt
  apt-get update -y && apt-get install -y tesseract-ocr
  ```
- **Start Command**: `cd server && uvicorn app:app --host 0.0.0.0 --port $PORT`

### 3. Set Environment Variables

Add the following environment variables in the Render dashboard:

- `OPENROUTER_API_KEY`: Your OpenRouter API key
- `SUPABASE_URL`: Your Supabase URL
- `SUPABASE_KEY`: Your Supabase service key
- `RENDER`: true

### 4. Deploy

Click "Create Web Service" to deploy your application.

## Troubleshooting

If you encounter issues with Tesseract OCR:

1. Check the build logs to ensure Tesseract was installed correctly
2. Verify that the environment variables are set correctly
3. Try redeploying the application

## Frontend Deployment

To deploy the frontend:

1. Create a new Static Site on Render
2. Connect your repository
3. Set the build command to:
   ```
   npm install && npm run build
   ```
4. Set the publish directory to `dist`
5. Add the environment variable `VITE_API_URL` pointing to your backend URL

## Connecting Frontend to Backend

Update the `.env` file in your frontend project:

```
VITE_API_URL=https://your-backend-url.onrender.com
```

Replace `your-backend-url` with the actual URL of your deployed backend service.