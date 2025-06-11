import React from "react";
import type { ExtendedContentBlock } from "@/types/broker-state";
import { MultimodalPreview } from "./MultimodalPreview";
import { cn } from "@/lib/utils";
import type { ExtendedContentBlock } from "@/lib/multimodal-utils";

interface ContentBlocksPreviewProps {
  blocks: ExtendedContentBlock[];
  onRemove: (idx: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  messageId?: string;
}

/**
 * Renders a preview of content blocks with optional remove functionality.
 * Uses cn utility for robust class merging.
 */
export const ContentBlocksPreview: React.FC<ContentBlocksPreviewProps> = ({
  blocks,
  onRemove,
  size = "md",
  className,
  messageId,
}) => {
  if (!blocks.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-2 p-3.5 pb-0", className)}>
      {blocks.map((block, idx) => (
        <MultimodalPreview
          key={idx}
          block={block}
          removable
          onRemove={() => onRemove(idx)}
          size={size}
          messageId={messageId}
        />
      ))}
    </div>
  );
};
