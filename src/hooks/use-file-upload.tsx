import { useState, useRef, useEffect, ChangeEvent, useCallback } from "react";
import { toast } from "sonner";
import type { Base64ContentBlock } from "@langchain/core/messages";
import {
  fileToContentBlock,
  SUPPORTED_IMAGE_TYPES,
  cleanupObjectUrls,
  type ExtendedContentBlock,
} from "@/lib/multimodal-utils";

interface UseFileUploadOptions {
  initialBlocks?: ExtendedContentBlock[];
}

export function useFileUpload({
  initialBlocks = [],
}: UseFileUploadOptions = {}) {
  const [contentBlocks, setContentBlocks] =
    useState<ExtendedContentBlock[]>(initialBlocks);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  const isDuplicate = (file: File, blocks: ExtendedContentBlock[]) => {
    if (SUPPORTED_IMAGE_TYPES.includes(file.type as any)) {
      return blocks.some(
        (b) =>
          b.type === "image" &&
          b.metadata?.name === file.name &&
          b.mime_type === file.type,
      );
    }
    return false;
  };

  const processFiles = useCallback(
    async (files: File[]) => {
      const validFiles = files.filter((file) =>
        SUPPORTED_IMAGE_TYPES.includes(file.type as any),
      );
      const invalidFiles = files.filter(
        (file) => !SUPPORTED_IMAGE_TYPES.includes(file.type as any),
      );
      const duplicateFiles = validFiles.filter((file) =>
        isDuplicate(file, contentBlocks),
      );
      const uniqueFiles = validFiles.filter(
        (file) => !isDuplicate(file, contentBlocks),
      );

      if (invalidFiles.length > 0) {
        toast.error(
          "Invalid file type detected. Please upload a JPEG, PNG, GIF, or WEBP image.",
        );
      }
      if (duplicateFiles.length > 0) {
        toast.error(
          `Duplicate image(s) detected: ${duplicateFiles.map((f) => f.name).join(", ")}. Each image can only be uploaded once per message.`,
        );
      }

      if (uniqueFiles.length > 0) {
        const newBlocks = await Promise.all(
          uniqueFiles.map(fileToContentBlock),
        );
        setContentBlocks((prev) => [...prev, ...newBlocks]);
      }
    },
    [contentBlocks],
  );

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    await processFiles(Array.from(files));
    e.target.value = "";
  };

  // Drag and drop handlers
  useEffect(() => {
    if (!dropRef.current) return;

    // Global drag events with counter for robust dragOver state
    const handleWindowDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        dragCounter.current += 1;
        setDragOver(true);
      }
    };
    const handleWindowDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
          setDragOver(false);
          dragCounter.current = 0;
        }
      }
    };
    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragOver(false);

      if (!e.dataTransfer) return;

      await processFiles(Array.from(e.dataTransfer.files));
    };
    const handleWindowDragEnd = (e: DragEvent) => {
      dragCounter.current = 0;
      setDragOver(false);
    };
    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragend", handleWindowDragEnd);

    // Prevent default browser behavior for dragover globally
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("dragover", handleWindowDragOver);

    // Remove element-specific drop event (handled globally)
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
    };
    const element = dropRef.current;
    element.addEventListener("dragover", handleDragOver);
    element.addEventListener("dragenter", handleDragEnter);
    element.addEventListener("dragleave", handleDragLeave);

    return () => {
      element.removeEventListener("dragover", handleDragOver);
      element.removeEventListener("dragenter", handleDragEnter);
      element.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragend", handleWindowDragEnd);
      window.removeEventListener("dragover", handleWindowDragOver);
      dragCounter.current = 0;
    };
  }, [processFiles]);

  const removeBlock = (idx: number) => {
    setContentBlocks((prev) => {
      const blockToRemove = prev[idx];
      // Clean up object URL if it exists
      if (blockToRemove?.source_type === "url" && 
          blockToRemove.metadata?.isObjectUrl && 
          blockToRemove.data.startsWith('blob:')) {
        URL.revokeObjectURL(blockToRemove.data);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const resetBlocks = () => {
    setContentBlocks((prev) => {
      // Clean up all object URLs before resetting
      cleanupObjectUrls(prev);
      return [];
    });
  };

  /**
   * Handle paste event for files (images, PDFs)
   * Can be used as onPaste={handlePaste} on a textarea or input
   */
  const handlePaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const items = e.clipboardData.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length === 0) return;

    e.preventDefault();
    await processFiles(files);
  };

  return {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks,
    dragOver,
    handlePaste,
  };
}
