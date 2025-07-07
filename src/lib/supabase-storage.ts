import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// ==========================================
// STORAGE BUCKET TYPES
// ==========================================

export type StorageBucket = 'user-avatars' | 'learning-materials' | 'user-uploads';

export interface UploadOptions {
  cacheControl?: string;
  contentType?: string;
  upsert?: boolean;
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  data: {
    path: string;
    id: string;
    fullPath: string;
  } | null;
  error: Error | null;
}

export interface FileMetadata {
  size: number;
  mimetype: string;
  cacheControl: string;
  etag: string;
  lastModified: string;
  contentLength: number;
  httpStatusCode: number;
}

// ==========================================
// STORAGE CONFIGURATION
// ==========================================

const STORAGE_CONFIG = {
  'user-avatars': {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    quality: 80,
    resize: { width: 400, height: 400 }
  },
  'learning-materials': {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'video/mp4', 'video/webm',
      'audio/mpeg', 'audio/wav', 'audio/ogg'
    ]
  },
  'user-uploads': {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/markdown',
      'application/json'
    ]
  }
} as const;

// ==========================================
// STORAGE ERROR HANDLING
// ==========================================

export class StorageError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

// ==========================================
// STORAGE SERVICE CLASS
// ==========================================

export class SupabaseStorageService {
  /**
   * Upload a file to a specific bucket
   */
  static async uploadFile(
    bucket: StorageBucket,
    file: File | Blob,
    path?: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      // Validate file
      this.validateFile(bucket, file);

      // Generate path if not provided
      const filePath = path || this.generateFilePath(bucket, file);
      
      // Prepare upload options
      const uploadOptions = {
        cacheControl: options.cacheControl || '3600',
        contentType: options.contentType || this.getContentType(file),
        upsert: options.upsert || false,
      };

      // Upload file
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, uploadOptions);

      if (error) {
        throw new StorageError(
          `Failed to upload file: ${error.message}`,
          error.name,
          error.statusCode
        );
      }

      return {
        data: {
          path: data.path,
          id: data.id,
          fullPath: data.fullPath
        },
        error: null
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      return {
        data: null,
        error: error instanceof StorageError ? error : new StorageError('Unknown upload error')
      };
    }
  }

  /**
   * Upload user avatar
   */
  static async uploadUserAvatar(
    userId: string,
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const path = `${userId}/avatar.${this.getFileExtension(file)}`;
    return this.uploadFile('user-avatars', file, path, {
      ...options,
      upsert: true // Allow overwriting existing avatars
    });
  }

  /**
   * Upload learning material
   */
  static async uploadLearningMaterial(
    contentId: string,
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const fileName = file.name || `material-${Date.now()}`;
    const path = `${contentId}/${fileName}`;
    return this.uploadFile('learning-materials', file, path, options);
  }

  /**
   * Upload user file
   */
  static async uploadUserFile(
    userId: string,
    file: File,
    folder: string = 'general',
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const fileName = file.name || `file-${Date.now()}`;
    const path = `${userId}/${folder}/${fileName}`;
    return this.uploadFile('user-uploads', file, path, options);
  }

  /**
   * Download a file
   */
  static async downloadFile(bucket: StorageBucket, path: string): Promise<Blob | null> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path);

      if (error) {
        throw new StorageError(
          `Failed to download file: ${error.message}`,
          error.name,
          error.statusCode
        );
      }

      return data;
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  }

  /**
   * Get public URL for a file
   */
  static getPublicUrl(bucket: StorageBucket, path: string): string {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Get signed URL for private files
   */
  static async getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresIn: number = 3600
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        throw new StorageError(
          `Failed to create signed URL: ${error.message}`,
          error.name,
          error.statusCode
        );
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
  }

  /**
   * Delete a file
   */
  static async deleteFile(bucket: StorageBucket, path: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        throw new StorageError(
          `Failed to delete file: ${error.message}`,
          error.name,
          error.statusCode
        );
      }

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * List files in a folder
   */
  static async listFiles(
    bucket: StorageBucket,
    folder: string = '',
    options: {
      limit?: number;
      offset?: number;
      sortBy?: { column: string; order: 'asc' | 'desc' };
    } = {}
  ) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder, {
          limit: options.limit || 100,
          offset: options.offset || 0,
          sortBy: options.sortBy || { column: 'name', order: 'asc' }
        });

      if (error) {
        throw new StorageError(
          `Failed to list files: ${error.message}`,
          error.name,
          error.statusCode
        );
      }

      return data;
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(
    bucket: StorageBucket,
    path: string
  ): Promise<FileMetadata | null> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .getFileInfo(path);

      if (error) {
        throw new StorageError(
          `Failed to get file metadata: ${error.message}`,
          error.name,
          error.statusCode
        );
      }

      return data as FileMetadata;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return null;
    }
  }

  /**
   * Move a file
   */
  static async moveFile(
    bucket: StorageBucket,
    fromPath: string,
    toPath: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .move(fromPath, toPath);

      if (error) {
        throw new StorageError(
          `Failed to move file: ${error.message}`,
          error.name,
          error.statusCode
        );
      }

      return true;
    } catch (error) {
      console.error('Error moving file:', error);
      return false;
    }
  }

  /**
   * Copy a file
   */
  static async copyFile(
    bucket: StorageBucket,
    fromPath: string,
    toPath: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .copy(fromPath, toPath);

      if (error) {
        throw new StorageError(
          `Failed to copy file: ${error.message}`,
          error.name,
          error.statusCode
        );
      }

      return true;
    } catch (error) {
      console.error('Error copying file:', error);
      return false;
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Validate file before upload
   */
  private static validateFile(bucket: StorageBucket, file: File | Blob): void {
    const config = STORAGE_CONFIG[bucket];
    
    // Check file size
    if (file.size > config.maxFileSize) {
      throw new StorageError(
        `File size exceeds limit of ${config.maxFileSize / 1024 / 1024}MB`
      );
    }

    // Check MIME type for files (not Blob)
    if (file instanceof File && config.allowedMimeTypes) {
      if (!config.allowedMimeTypes.includes(file.type)) {
        throw new StorageError(
          `File type ${file.type} is not allowed. Allowed types: ${config.allowedMimeTypes.join(', ')}`
        );
      }
    }
  }

  /**
   * Generate a unique file path
   */
  private static generateFilePath(bucket: StorageBucket, file: File | Blob): string {
    const extension = file instanceof File 
      ? this.getFileExtension(file)
      : 'blob';
    
    const timestamp = Date.now();
    const uuid = uuidv4();
    
    return `${timestamp}-${uuid}.${extension}`;
  }

  /**
   * Get file extension
   */
  private static getFileExtension(file: File): string {
    const fileName = file.name || '';
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.substring(lastDot + 1) : 'bin';
  }

  /**
   * Get content type
   */
  private static getContentType(file: File | Blob): string {
    return file.type || 'application/octet-stream';
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if file type is image
   */
  static isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Check if file type is video
   */
  static isVideoFile(file: File): boolean {
    return file.type.startsWith('video/');
  }

  /**
   * Check if file type is audio
   */
  static isAudioFile(file: File): boolean {
    return file.type.startsWith('audio/');
  }

  /**
   * Check if file type is document
   */
  static isDocumentFile(file: File): boolean {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown'
    ];
    return documentTypes.includes(file.type);
  }
}

// ==========================================
// CONVENIENCE FUNCTIONS
// ==========================================

/**
 * Upload user avatar with automatic resizing
 */
export async function uploadUserAvatar(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  try {
    const result = await SupabaseStorageService.uploadUserAvatar(userId, file, {
      onProgress
    });

    if (result.error) {
      throw result.error;
    }

    return result.data ? SupabaseStorageService.getPublicUrl('user-avatars', result.data.path) : null;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return null;
  }
}

/**
 * Get user avatar URL
 */
export function getUserAvatarUrl(userId: string, format: string = 'webp'): string {
  return SupabaseStorageService.getPublicUrl('user-avatars', `${userId}/avatar.${format}`);
}

/**
 * Upload learning material with metadata
 */
export async function uploadLearningMaterial(
  contentId: string,
  file: File,
  metadata: { title?: string; description?: string } = {}
): Promise<string | null> {
  try {
    const result = await SupabaseStorageService.uploadLearningMaterial(contentId, file);

    if (result.error) {
      throw result.error;
    }

    // Store metadata in the database if needed
    // This would be handled by a separate service

    return result.data ? result.data.path : null;
  } catch (error) {
    console.error('Error uploading learning material:', error);
    return null;
  }
}

// Export the main service class and utility functions
export default SupabaseStorageService;
export { SupabaseStorageService };