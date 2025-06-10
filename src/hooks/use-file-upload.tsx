import { useState, useRef, useEffect, ChangeEvent, useCallback } from "react";
import { toast } from "sonner";
import type { ExtendedContentBlock, UploadProgress, UploadResponse } from "@/types/broker-state";
import { SUPPORTED_IMAGE_TYPES } from "@/lib/multimodal-utils";
import { createUrlContentBlock } from "@/types/broker-state";

interface UseFileUploadOptions {
  initialBlocks?: ExtendedContentBlock[];
}

export function useFileUpload({
  initialBlocks = [],
}: UseFileUploadOptions = {}) {
  const [contentBlocks, setContentBlocks] =
    useState<ExtendedContentBlock[]>(initialBlocks);
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  const isDuplicate = (file: File, blocks: ExtendedContentBlock[]) => {
    if (SUPPORTED_IMAGE_TYPES.includes(file.type as any)) {
      return blocks.some(
        (b) =>
          b.type === "image" &&
          b.metadata?.originalName === file.name,
      );
    }
    return false;
  };

  // Upload file to S3 via API
  const uploadFileToS3 = async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    return response.json();
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

      // Process uploads with progress tracking
      for (const file of uniqueFiles) {
        const fileId = `${file.name}-${file.size}-${file.lastModified}`;
        
        // Initialize upload progress
        setUploadProgress(prev => new Map(prev.set(fileId, {
          file,
          progress: 0,
          status: 'uploading',
        })));

        try {
          // Upload to S3
          const uploadResponse = await uploadFileToS3(file);
          
          // Update progress to completed
          setUploadProgress(prev => new Map(prev.set(fileId, {
            file,
            progress: 100,
            status: 'completed',
            result: uploadResponse,
          })));

          // Create URL content block and add to state
          const urlBlock = createUrlContentBlock(uploadResponse, file);
          setContentBlocks(prev => [...prev, urlBlock]);

          toast.success(`Image "${file.name}" uploaded successfully`);

        } catch (error) {
          console.error('Upload error:', error);
          
          // Update progress to error
          setUploadProgress(prev => new Map(prev.set(fileId, {
            file,
            progress: 0,
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed',
          })));

          toast.error(`Failed to upload "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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
    setContentBlocks((prev) => prev.filter((_, i) => i !== idx));
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

  // Clean up completed upload progress
  const cleanupUploadProgress = () => {
    setUploadProgress(prev => {
      const newMap = new Map(prev);
      for (const [key, progress] of newMap) {
        if (progress.status === 'completed') {
          newMap.delete(key);
        }
      }
      return newMap;
    });
  };

  return {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks: () => {
      setContentBlocks([]);
      setUploadProgress(new Map());
    },
    dragOver,
    handlePaste,
    uploadProgress,
    cleanupUploadProgress,
    isUploading: Array.from(uploadProgress.values()).some(p => p.status === 'uploading'),
  };
}
