import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export interface UploadProgress {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
}

export function uploadFile(
  file: File, 
  path: string, 
  onProgress?: (progress: UploadProgress) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!storage) {
      reject(new Error('Firebase Storage not initialized'));
      return;
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}_${randomString}.${fileExtension}`;
    
    const storageRef = ref(storage, `${path}/${fileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.({
          progress,
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
        });
      },
      (error) => {
        console.error('Upload failed:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

export function uploadMultipleFiles(
  files: File[],
  path: string,
  onProgress?: (fileIndex: number, progress: UploadProgress) => void
): Promise<string[]> {
  const uploadPromises = files.map((file, index) =>
    uploadFile(file, path, (progress) => onProgress?.(index, progress))
  );
  
  return Promise.all(uploadPromises);
}

export function getFileType(file: File): 'image' | 'video' | 'document' | 'other' {
  const type = file.type.toLowerCase();
  
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.includes('pdf') || type.includes('document') || type.includes('text')) return 'document';
  
  return 'other';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function validateFile(file: File, options: {
  maxSize?: number; // in MB
  allowedTypes?: string[];
} = {}): { valid: boolean; error?: string } {
  const { maxSize = 10, allowedTypes } = options;
  
  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSize) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the maximum allowed size of ${maxSize}MB`
    };
  }
  
  // Check file type
  if (allowedTypes && !allowedTypes.some(type => file.type.includes(type))) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
    };
  }
  
  return { valid: true };
}