import type { Base64ContentBlock } from "@langchain/core/messages";
import type { ExtendedContentBlock } from "@/types/broker-state";
import { toast } from "sonner";

// Extended content block type that supports both base64 and URL sources
export interface ExtendedContentBlock extends Omit<Base64ContentBlock, 'source_type'> {
  source_type: "base64" | "url";
  metadata?: {
    name?: string;
    size?: number;
    lastModified?: number;
    isObjectUrl?: boolean;
    resized?: boolean;
  };
}

// Image types supported by LangGraph platforms
export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

// Maximum file size for direct embedding (500KB - conservative to avoid 413 errors)
const MAX_EMBEDDED_SIZE = 500 * 1024;
// Maximum file size for images (10MB - AWS API Gateway safe limit)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// Utility function to get image source from any content block type
export function getImageSrc(block: ExtendedContentBlock): string {
  if ("source" in block && block.source && block.source.type === "url") {
    return block.source.url;
  } else if ("source_type" in block && block.source_type === "base64" && "data" in block && "mime_type" in block) {
    return `data:${block.mime_type};base64,${block.data}`;
  }
  return "";
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

// Type guard for URL-based content blocks
export function isUrlContentBlock(
  block: unknown,
): block is ExtendedContentBlock & { source: { type: "url"; url: string } } {
  if (typeof block !== "object" || block === null || !("type" in block))
    return false;

  return (
    (block as { type: unknown }).type === "image" &&
    "source" in block &&
    typeof (block as { source?: unknown }).source === "object" &&
    (block as { source: any }).source !== null &&
    (block as { source: { type?: unknown } }).source.type === "url" &&
    typeof (block as { source: { url?: unknown } }).source.url === "string"
  );
}

// Validate file for upload (client-side validation before API call)
export function validateImageFileForUpload(file: File): { valid: boolean; error?: string } {
  // Validate file type
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Please upload JPEG, PNG, GIF, or WEBP images only.`,
    };
  }

  // Validate file size
  if (file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `Image too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size is 10MB.`,
    };
  }

  return { valid: true };
}

// Helper to convert File to base64 string (legacy support)
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

// Legacy function for backwards compatibility - now deprecated
export async function fileToContentBlock(
  file: File,
): Promise<Base64ContentBlock> {
  console.warn("fileToContentBlock is deprecated. Use the new upload API via useFileUpload hook instead.");
  
  // Validate file
  const validation = validateImageFileForUpload(file);
  if (!validation.valid) {
    toast.error(validation.error);
    return Promise.reject(new Error(validation.error));
  }

  const data = await fileToBase64(file);

  // Return standardized content block format for LangGraph
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
}
