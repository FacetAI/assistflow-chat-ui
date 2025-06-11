import React, { useState } from "react";
import { File, X as XIcon, Loader2 } from "lucide-react";
import type { ExtendedContentBlock } from "@/types/broker-state";
import { cn } from "@/lib/utils";
import { getImageSrc } from "@/lib/multimodal-utils";
import { useCachedImage } from "@/lib/image-cache";
import Image from "next/image";

export interface MultimodalPreviewProps {
  block: ExtendedContentBlock;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  messageId?: string;
}

export const MultimodalPreview: React.FC<MultimodalPreviewProps> = ({
  block,
  removable = false,
  onRemove,
  className,
  size = "md",
  messageId,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Always call hooks at the top level
  const imageSrc = block.type === "image" ? getImageSrc(block) : null;
  const shouldUseCache = block.type === "image" && "source" in block && block.source && block.source.type === "url";
  const { cachedUrl, isLoading: cacheLoading } = useCachedImage(
    shouldUseCache ? imageSrc : null,
    messageId
  );

  // Image block - supporting both URL and base64 sources
  if (block.type === "image") {
    if (!imageSrc) {
      return (
        <div className={cn("relative inline-block", className)}>
          <div className="flex items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 p-4">
            <File className="h-8 w-8 text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Invalid image</span>
          </div>
        </div>
      );
    }

    let imgClass: string = "rounded-md object-cover h-16 w-16";
    let containerClass: string = "h-16 w-16";
    if (size === "sm") {
      imgClass = "rounded-md object-cover h-10 w-10";
      containerClass = "h-10 w-10";
    }
    if (size === "lg") {
      imgClass = "rounded-md object-cover h-24 w-24";
      containerClass = "h-24 w-24";
    }

    // Enhanced metadata display
    const imageName = block.metadata?.originalName || (block.metadata as any)?.name || "uploaded image";
    const imageSize = block.metadata?.size && typeof block.metadata.size === "number"
        ? `(${(block.metadata.size / 1024).toFixed(1)}KB)`
        : "";

    if (imageError) {
      return (
        <div className={cn("relative inline-block", className)}>
          <div className={cn("flex items-center justify-center border-2 border-dashed border-red-300 bg-red-50 rounded-md", containerClass)}>
            <File className="h-6 w-6 text-red-400" />
          </div>
          {removable && (
            <button
              type="button"
              className="absolute -top-1 -right-1 z-10 rounded-full bg-red-500 text-white hover:bg-red-700 p-1"
              onClick={onRemove}
              aria-label={`Remove ${imageName}`}
            >
              <XIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      );
    }

    return (
      <div className={cn("relative inline-block", className)}>
        <div className={cn("relative", containerClass)}>
          {(imageLoading || cacheLoading) && (
            <div className={cn("absolute inset-0 flex items-center justify-center bg-gray-100 rounded-md", containerClass)}>
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}
          
          {/* Use Next.js Image for URL sources, regular img for base64 */}
          {"source" in block && block.source?.type === "url" ? (
            <Image
              src={cachedUrl || imageSrc}
              alt={`${imageName} ${imageSize}`}
              className={cn(imgClass, (imageLoading || cacheLoading) ? "opacity-0" : "opacity-100")}
              width={size === "sm" ? 40 : size === "md" ? 64 : 96}
              height={size === "sm" ? 40 : size === "md" ? 64 : 96}
              style={{ width: "auto", height: "auto" }}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
              unoptimized={false}
            />
          ) : (
            <img
              src={imageSrc}
              alt={`${imageName} ${imageSize}`}
              className={cn(imgClass, imageLoading ? "opacity-0" : "opacity-100")}
              style={{ width: "auto", height: "auto" }}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
            />
          )}
        </div>
        
        {removable && (
          <button
            type="button"
            className="absolute -top-1 -right-1 z-10 rounded-full bg-gray-500 text-white hover:bg-gray-700 p-1"
            onClick={onRemove}
            aria-label={`Remove ${imageName}`}
          >
            <XIcon className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  // Fallback for non-image types (should not occur with new implementation)
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-red-50 px-3 py-2 text-red-500",
        className,
      )}
    >
      <File className="h-5 w-5 flex-shrink-0" />
      <span className="truncate text-xs">
        Image type only - unsupported content
      </span>
      {removable && (
        <button
          type="button"
          className="ml-2 rounded-full bg-red-200 p-1 text-red-500 hover:bg-red-300"
          onClick={onRemove}
          aria-label="Remove unsupported content"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
