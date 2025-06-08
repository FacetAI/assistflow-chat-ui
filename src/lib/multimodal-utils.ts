import type { Base64ContentBlock } from "@langchain/core/messages";
import { toast } from "sonner";

// Extended content block type that supports both base64 and URL sources
export interface ExtendedContentBlock extends Omit<Base64ContentBlock, 'source_type'> {
  source_type: "base64" | "url";
  metadata?: {
    name?: string;
    size?: number;
    lastModified?: number;
    isObjectUrl?: boolean;
  };
}

// Image types supported by LangGraph platforms
export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

// Maximum file size for direct embedding (512KB - very conservative)
const MAX_EMBEDDED_SIZE = 512 * 1024;
// Maximum file size for images (10MB - AWS API Gateway safe limit)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// Returns a Promise of a typed multimodal block following LangGraph best practices
export async function fileToContentBlock(
  file: File,
): Promise<ExtendedContentBlock> {
  // Validate file type
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as any)) {
    toast.error(
      `Unsupported file type: ${file.type}. Please upload JPEG, PNG, GIF, or WEBP images only.`,
    );
    return Promise.reject(new Error(`Unsupported file type: ${file.type}`));
  }

  // Validate file size
  if (file.size > MAX_IMAGE_SIZE) {
    toast.error(
      `Image too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size is 10MB.`,
    );
    return Promise.reject(new Error(`Image too large: ${file.size} bytes`));
  }

  // For very small files, embed as base64. For larger files, use object URL to avoid payload limits
  if (file.size <= MAX_EMBEDDED_SIZE) {
    const data = await fileToBase64(file);
    
    return {
      type: "image",
      source_type: "base64",
      mime_type: file.type,
      data,
      metadata: {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
      },
    };
  } else {
    // For larger files, use object URL to avoid embedding in message payload
    const objectUrl = URL.createObjectURL(file);
    
    return {
      type: "image",
      source_type: "url",
      mime_type: file.type,
      data: objectUrl,
      metadata: {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        isObjectUrl: true,
      },
    };
  }
}

// Helper to convert File to base64 string
export async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data:...;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Type guard for ContentBlock (images - both base64 and URL)
export function isImageContentBlock(
  block: unknown,
): block is ExtendedContentBlock {
  if (typeof block !== "object" || block === null || !("type" in block))
    return false;

  // Validate image type blocks following LangGraph standards
  return (
    (block as { type: unknown }).type === "image" &&
    "source_type" in block &&
    ((block as { source_type: unknown }).source_type === "base64" ||
     (block as { source_type: unknown }).source_type === "url") &&
    "mime_type" in block &&
    typeof (block as { mime_type?: unknown }).mime_type === "string" &&
    (block as { mime_type: string }).mime_type.startsWith("image/") &&
    "data" in block &&
    typeof (block as { data?: unknown }).data === "string"
  );
}

// Legacy function for backward compatibility
export function isBase64ContentBlock(
  block: unknown,
): block is Base64ContentBlock {
  return isImageContentBlock(block) && 
    (block as any).source_type === "base64";
}

// Cleanup function for object URLs to prevent memory leaks
export function cleanupObjectUrls(contentBlocks: ExtendedContentBlock[]) {
  contentBlocks.forEach(block => {
    if (block.source_type === "url" && 
        block.metadata?.isObjectUrl && 
        block.data.startsWith('blob:')) {
      URL.revokeObjectURL(block.data);
    }
  });
}
