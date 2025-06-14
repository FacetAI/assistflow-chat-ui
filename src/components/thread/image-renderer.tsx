import { useState } from "react";
import type { ReactElement } from "react";

// Helper function to detect if a value looks like an image
export function isImageValue(key: string, value: unknown): boolean {
  if (typeof value !== "string") return false;

  const imageKeys = [
    "image_uri",
    "base64_image",
    "image_url",
    "image_data",
    "image",
    "picture",
    "photo",
  ];
  const lowercaseKey = key.toLowerCase();

  // Check if key indicates it's an image
  if (imageKeys.some((imgKey) => lowercaseKey.includes(imgKey))) {
    return true;
  }

  // Check if value looks like a base64 image
  if (typeof value === "string" && value.startsWith("data:image/")) {
    return true;
  }

  // Check if value looks like an image URL
  if (
    typeof value === "string" &&
    (value.startsWith("http") || value.startsWith("/"))
  ) {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    return imageExtensions.some((ext) => value.toLowerCase().includes(ext));
  }

  return false;
}

// Component to render inline images with error handling
export function ImageRenderer({
  src,
  alt,
  className,
  contentBlock,
}: {
  src: string;
  alt?: string;
  className?: string;
  contentBlock?: any;
}) {
  const [imageError, setImageError] = useState(false);

  // Handle different source types
  const getImageSrc = () => {
    if (src.startsWith('blob:') || src.startsWith('http')) {
      // Object URL or external URL
      return src;
    } else if (src.startsWith('data:image/')) {
      // Already a data URL
      return src;
    } else {
      // Assume it's base64 data, construct data URL
      const mimeType = contentBlock?.mime_type || 'image/jpeg';
      return `data:${mimeType};base64,${src}`;
    }
  };

  if (imageError) {
    return (
      <div className="my-4 max-w-md rounded-lg border border-gray-200 bg-gray-100 p-4">
        <p className="text-sm text-gray-600">Failed to load image</p>
        <p className="mt-1 text-xs break-all text-gray-400">{src.substring(0, 100)}...</p>
        {contentBlock?.metadata?.size && (
          <p className="mt-1 text-xs text-gray-400">
            Size: {(contentBlock.metadata.size / 1024 / 1024).toFixed(1)}MB
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`my-4 ${className || ""}`}>
      <img
        src={getImageSrc()}
        alt={alt || "Generated image"}
        className="max-h-96 max-w-full rounded-lg border border-gray-200 shadow-sm"
        onError={() => setImageError(true)}
        loading="lazy"
      />
      {contentBlock?.metadata?.size && (
        <p className="mt-2 text-xs text-gray-500">
          {contentBlock.metadata.name} ({(contentBlock.metadata.size / 1024 / 1024).toFixed(1)}MB)
        </p>
      )}
    </div>
  );
}

// Function to extract and render images from structured data
export function extractAndRenderImages(content: string): {
  hasImages: boolean;
  component: ReactElement | null;
} {
  try {
    // Try to parse as JSON to look for structured image data
    const parsed = JSON.parse(content);
    const images: Array<{ key: string; src: string }> = [];

    function findImages(obj: any, prefix = ""): void {
      if (typeof obj === "object" && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (isImageValue(key, value)) {
            images.push({ key: fullKey, src: value as string });
          } else if (typeof value === "object") {
            findImages(value, fullKey);
          }
        });
      }
    }

    findImages(parsed);

    if (images.length > 0) {
      return {
        hasImages: true,
        component: (
          <div className="space-y-4">
            {images.map(({ key, src }, index) => (
              <div key={index}>
                <p className="mb-2 text-sm text-gray-600">{key}:</p>
                <ImageRenderer
                  src={src}
                  alt={`Image: ${key}`}
                />
              </div>
            ))}
          </div>
        ),
      };
    }
  } catch {
    // Not valid JSON, continue with text processing
  }

  // Look for standalone image URLs in plain text
  const imageUrlPattern =
    /(https?:\/\/[^\s]+(?:\.(?:jpg|jpeg|png|gif|webp|svg))[^\s]*|data:image\/[^;]+;base64,[^)\s]+)/gi;
  const matches = content.match(imageUrlPattern);

  if (matches && matches.length > 0) {
    return {
      hasImages: true,
      component: (
        <div className="space-y-4">
          {matches.map((src, index) => (
            <ImageRenderer
              key={index}
              src={src}
              alt={`Image ${index + 1}`}
            />
          ))}
        </div>
      ),
    };
  }

  return { hasImages: false, component: null };
}
