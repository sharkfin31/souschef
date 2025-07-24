const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Base API client for making HTTP requests
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make a GET request
   */
  async get(endpoint: string) {
    const response = await fetch(`${this.baseUrl}/api${endpoint}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to fetch from ${endpoint}`);
    }
    
    return await response.json();
  }

  /**
   * Make a POST request with JSON body
   */
  async post(endpoint: string, data: any) {
    const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to post to ${endpoint}`);
    }
    
    return await response.json();
  }

  /**
   * Make a POST request with FormData
   */
  async postForm(endpoint: string, formData: FormData) {
    const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to post form to ${endpoint}`);
    }
    
    return await response.json();
  }
}

export const apiClient = new ApiClient(API_URL);