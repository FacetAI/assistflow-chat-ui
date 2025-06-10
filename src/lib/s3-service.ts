import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CONFIG, validateS3Config, generateImageKey } from './config';

// Initialize S3 client
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    validateS3Config();
    
    s3Client = new S3Client({
      region: S3_CONFIG.REGION,
      credentials: {
        accessKeyId: S3_CONFIG.ACCESS_KEY_ID,
        secretAccessKey: S3_CONFIG.SECRET_ACCESS_KEY,
      },
    });
  }
  
  return s3Client;
}

// Image processing utilities
async function processImage(buffer: Buffer): Promise<Buffer> {
  // For now, return the original buffer
  // TODO: Add image optimization (resize, compress) using sharp or similar
  return buffer;
}

// Upload image to S3
export interface UploadImageResult {
  success: boolean;
  imageUrl?: string;
  key?: string;
  error?: string;
}

export async function uploadImage(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  userId?: string
): Promise<UploadImageResult> {
  try {
    const client = getS3Client();
    const key = generateImageKey(originalName, userId);
    
    // Process the image (resize, compress, etc.)
    const processedBuffer = await processImage(buffer);
    
    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key,
      Body: processedBuffer,
      ContentType: mimeType,
      ContentDisposition: 'inline',
      CacheControl: 'public, max-age=31536000', // Cache for 1 year
      Metadata: {
        originalName,
        uploadedAt: new Date().toISOString(),
        userId: userId || 'anonymous',
      },
    });

    await client.send(command);
    
    // Generate presigned URL for secure access
    const presignedUrl = await generatePresignedUrl(key);
    if (!presignedUrl) {
      throw new Error('Failed to generate presigned URL');
    }
    
    return {
      success: true,
      imageUrl: presignedUrl,
      key,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    };
  }
}

// Generate presigned URL for temporary access
export async function generatePresignedUrl(key: string): Promise<string | null> {
  try {
    const client = getS3Client();
    
    const command = new GetObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(client, command, {
      expiresIn: S3_CONFIG.PRESIGNED_URL_EXPIRY,
    });

    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return null;
  }
}

// Validate file before upload
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(
  buffer: Buffer,
  mimeType: string,
  originalName: string
): FileValidationResult {
  // Check file type
  if (!S3_CONFIG.SUPPORTED_FORMATS.includes(mimeType as any)) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Supported formats: ${S3_CONFIG.SUPPORTED_FORMATS.join(', ')}`,
    };
  }

  // Check file size
  if (buffer.length > S3_CONFIG.MAX_FILE_SIZE) {
    const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
    const maxSizeMB = (S3_CONFIG.MAX_FILE_SIZE / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `File too large: ${sizeMB}MB. Maximum size: ${maxSizeMB}MB`,
    };
  }

  // Check filename
  if (!originalName || originalName.trim() === '') {
    return {
      valid: false,
      error: 'Invalid filename',
    };
  }

  return { valid: true };
}

// Retry wrapper for network operations
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
    }
  }
  
  throw lastError!;
}

// Upload with retry logic
export async function uploadImageWithRetry(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  userId?: string
): Promise<UploadImageResult> {
  return withRetry(
    () => uploadImage(buffer, originalName, mimeType, userId),
    3,
    1000
  );
}