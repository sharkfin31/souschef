import { apiClient } from './apiClient';

type ApiSuccess<T> = { success: boolean; message?: string; data: T };

export type UploadRecipeVideoResult = {
  video_url: string;
  stored_in_bucket: boolean;
};

/**
 * Upload a video file to R2 or Supabase Storage and link the public URL on the recipe.
 */
export async function uploadRecipeVideoFile(
  recipeId: string,
  file: File
): Promise<UploadRecipeVideoResult> {
  const form = new FormData();
  form.append('video', file);
  const res = (await apiClient.postForm(
    `/recipes/${recipeId}/video/upload`,
    form
  )) as ApiSuccess<UploadRecipeVideoResult>;

  if (!res.success || !res.data?.video_url) {
    throw new Error(res.message || 'Failed to upload video');
  }
  return res.data;
}
