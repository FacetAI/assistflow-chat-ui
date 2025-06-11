"use client";

import { useEffect, useState } from "react";
import { messageImagePersistence } from "@/lib/message-image-persistence";
import { ImageRenderer } from "./image-renderer";

interface MessageImageData {
  messageId: string;
  imageUrl?: string;
  userReferenceUrl?: string;
  base64Image?: string;
  videoUrl?: string;
  imagePrompt?: string;
  timestamp: number;
}

interface PersistentMessageImagesProps {
  messageId: string;
  className?: string;
}

export class PersistentImageRenderer {
  static renderImage(
    src: string, 
    alt: string, 
    messageId: string, 
    className?: string, 
    isReference = false
  ) {
    return (
      <div key={src} className={`max-w-md ${className || ""}`}>
        {isReference && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Reference Image
            </span>
          </div>
        )}
        <ImageRenderer
          src={src}
          alt={alt}
          messageId={messageId}
          className={isReference ? "opacity-75 border-border" : ""}
        />
      </div>
    );
  }

  static renderVideo(src: string, className?: string) {
    return (
      <div key={src} className={`max-w-md ${className || ""}`}>
        <video
          src={src}
          controls
          className="w-full rounded-lg border border-border shadow-sm"
          onError={(e) => {
            const target = e.target as HTMLVideoElement;
            target.style.display = "none";
          }}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }
}

export function PersistentMessageImages({ messageId, className = "" }: PersistentMessageImagesProps) {
  const [imageData, setImageData] = useState<MessageImageData | null>(null);

  useEffect(() => {
    if (!messageId) return;
    
    const data = messageImagePersistence.getMessageImages(messageId);
    setImageData(data);
  }, [messageId]);

  if (!imageData) return null;

  const hasAnyMedia = !!(
    imageData.imageUrl || 
    imageData.userReferenceUrl || 
    imageData.base64Image || 
    imageData.videoUrl
  );

  if (!hasAnyMedia) return null;

  return (
    <div className={`mt-2 flex flex-col gap-2 ${className}`}>
      {/* Render main generated image from URL */}
      {imageData.imageUrl && 
        PersistentImageRenderer.renderImage(
          imageData.imageUrl,
          imageData.imagePrompt || "Generated image",
          messageId
        )
      }

      {/* Render user reference image */}
      {imageData.userReferenceUrl && 
        PersistentImageRenderer.renderImage(
          imageData.userReferenceUrl,
          "User reference image",
          messageId,
          "",
          true
        )
      }

      {/* Legacy: Render base64 image (for backwards compatibility) */}
      {imageData.base64Image && !imageData.imageUrl && 
        PersistentImageRenderer.renderImage(
          imageData.base64Image.startsWith("data:")
            ? imageData.base64Image
            : `data:image/png;base64,${imageData.base64Image}`,
          imageData.imagePrompt || "Generated image",
          messageId
        )
      }

      {/* Legacy: Render video */}
      {imageData.videoUrl && 
        PersistentImageRenderer.renderVideo(imageData.videoUrl)
      }

      {/* Show image prompt if available */}
      {imageData.imagePrompt && (imageData.imageUrl || imageData.base64Image) && (
        <p className="text-sm text-muted-foreground italic">
          Prompt: {imageData.imagePrompt}
        </p>
      )}
    </div>
  );
}