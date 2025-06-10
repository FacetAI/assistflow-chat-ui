// Type definitions for the new BrokerState schema with URL-based images

export interface BrokerState {
  messages: any[]; // Keep flexible for LangGraph message types
  image_prompt?: string; // Current image generation prompt
  image_url?: string; // Current image public URL
  user_reference_url?: string; // Reference image URL for image generation
  features?: Record<string, any>; // Additional features
}

// URL-based content block for uploaded images (Anthropic format)
export interface UrlContentBlock {
  type: "image";
  source: {
    type: "url";
    url: string;
  };
  metadata?: {
    originalName?: string;
    size?: number;
    uploadedAt?: string;
    s3Key?: string;
  };
}

// Union type for content blocks (supporting both base64 and URL)
export type ExtendedContentBlock = import("@langchain/core/messages").Base64ContentBlock | UrlContentBlock;

// Upload response from API
export interface UploadResponse {
  success: boolean;
  imageUrl?: string;
  key?: string;
  error?: string;
  metadata?: {
    originalName: string;
    size: number;
    type: string;
    uploadedAt: string;
  };
}

// Upload progress tracking
export interface UploadProgress {
  file: File;
  progress: number; // 0-100
  status: 'uploading' | 'completed' | 'error';
  result?: UploadResponse;
  error?: string;
}

// Type guards
export function isUrlContentBlock(block: any): block is UrlContentBlock {
  return (
    block &&
    typeof block === 'object' &&
    block.type === 'image' &&
    block.source &&
    typeof block.source === 'object' &&
    block.source.type === 'url' &&
    typeof block.source.url === 'string'
  );
}

export function isBase64ContentBlock(block: any): block is import("@langchain/core/messages").Base64ContentBlock {
  return (
    block &&
    typeof block === 'object' &&
    block.type === 'image' &&
    block.source_type === 'base64' &&
    typeof block.data === 'string'
  );
}

// Utility to get image source regardless of type
export function getImageSource(block: ExtendedContentBlock): string {
  if (isUrlContentBlock(block)) {
    return block.source.url;
  } else if (isBase64ContentBlock(block)) {
    return `data:${block.mime_type};base64,${block.data}`;
  }
  return '';
}

// Convert File to UrlContentBlock (after upload)
export function createUrlContentBlock(
  uploadResponse: UploadResponse,
  originalFile: File
): UrlContentBlock {
  return {
    type: "image",
    source: {
      type: "url",
      url: uploadResponse.imageUrl!,
    },
    metadata: {
      originalName: originalFile.name,
      size: originalFile.size,
      uploadedAt: uploadResponse.metadata?.uploadedAt || new Date().toISOString(),
      s3Key: uploadResponse.key,
    },
  };
}