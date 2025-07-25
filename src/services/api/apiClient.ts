import { supabase } from '../../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Get authorization headers for authenticated requests
 */
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`
    };
  }
  
  return {};
};

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
    const authHeaders = await getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
      headers: {
        ...authHeaders
      }
    });
    
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
    const authHeaders = await getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
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
    const authHeaders = await getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
      method: 'POST',
      headers: {
        ...authHeaders
      },
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