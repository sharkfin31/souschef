export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      recipes: {
        Row: {
          id: string
          created_at: string
          title: string
          description: string | null
          source_url: string
          image_url: string | null
          prep_time: number | null
          cook_time: number | null
          servings: number | null
          user_id: string | null
          tags: string[] | null
        }
        Insert: {
          id?: string
          created_at?: string
          title: string
          description?: string | null
          source_url: string
          image_url?: string | null
          prep_time?: number | null
          cook_time?: number | null
          servings?: number | null
          user_id?: string | null
          tags?: string[] | null
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          description?: string | null
          source_url?: string
          image_url?: string | null
          prep_time?: number | null
          cook_time?: number | null
          servings?: number | null
          user_id?: string | null
          tags?: string[] | null
        }
      }
      ingredients: {
        Row: {
          id: string
          recipe_id: string
          name: string
          quantity: string | null
          unit: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          recipe_id: string
          name: string
          quantity?: string | null
          unit?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          recipe_id?: string
          name?: string
          quantity?: string | null
          unit?: string | null
          notes?: string | null
        }
      }
      instructions: {
        Row: {
          id: string
          recipe_id: string
          step_number: number
          description: string
        }
        Insert: {
          id?: string
          recipe_id: string
          step_number: number
          description: string
        }
        Update: {
          id?: string
          recipe_id?: string
          step_number?: number
          description?: string
        }
      }
      grocery_lists: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
        }
      }
      grocery_items: {
        Row: {
          id: string
          list_id: string
          ingredient_id: string | null
          name: string
          quantity: string | null
          unit: string | null
          completed: boolean
          recipe_id?: string | null
          recipe_title?: string | null
        }
        Insert: {
          id?: string
          list_id: string
          ingredient_id?: string | null
          name: string
          quantity?: string | null
          unit?: string | null
          completed?: boolean
          recipe_id?: string | null
          recipe_title?: string | null
        }
        Update: {
          id?: string
          list_id?: string
          ingredient_id?: string | null
          name?: string
          quantity?: string | null
          unit?: string | null
          completed?: boolean
          recipe_id?: string | null
          recipe_title?: string | null
        }
      }
    }
  }
}