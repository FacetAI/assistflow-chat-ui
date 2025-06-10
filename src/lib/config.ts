// Configuration constants for AWS S3 and image handling

export const S3_CONFIG = {
  // S3 Bucket configuration
  BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME!,
  REGION: process.env.AWS_S3_REGION || 'eu-west-1',
  ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
  SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
  
  // S3 public URL base
  S3_BASE_URL: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION || 'eu-west-1'}.amazonaws.com`,
  
  // File limits and settings
  MAX_FILE_SIZE: parseInt(process.env.AWS_S3_MAX_FILE_SIZE || '10485760'), // 10MB default
  PRESIGNED_URL_EXPIRY: parseInt(process.env.AWS_S3_PRESIGNED_URL_EXPIRY || '3600'), // 1 hour default
  
  // Image optimization settings
  MAX_WIDTH: 1920,
  MAX_HEIGHT: 1920,
  QUALITY: 80,
  
  // Supported formats
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
  
  // File naming
  FILE_PREFIX: 'uploads/',
} as const;

export const IMAGE_CONFIG = {
  // Client-side image settings
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_FILE_SIZE: S3_CONFIG.MAX_FILE_SIZE,
  PREVIEW_MAX_WIDTH: 200,
  PREVIEW_MAX_HEIGHT: 200,
} as const;

// Validation function for environment variables
export function validateS3Config() {
  const required = [
    'AWS_S3_BUCKET_NAME',
    'AWS_ACCESS_KEY_ID', 
    'AWS_SECRET_ACCESS_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing S3 environment variables:', missing);
    throw new Error(`Missing required S3 environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ S3 configuration validated successfully');
}

// Helper to generate S3 object key
export function generateImageKey(originalName: string, userId?: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const userPrefix = userId ? `${userId}/` : '';
  
  return `${S3_CONFIG.FILE_PREFIX}${userPrefix}${timestamp}-${randomId}.${extension}`;
}