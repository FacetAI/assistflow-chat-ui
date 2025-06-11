import type { BrokerState } from "@/types/broker-state";

interface MessageImageData {
  messageId: string;
  imageUrl?: string;
  userReferenceUrl?: string;
  base64Image?: string;
  videoUrl?: string;
  imagePrompt?: string;
  timestamp: number;
}

class MessageImagePersistenceManager {
  private storageKey = "facetai-message-images";

  private getStoredImages(): Record<string, MessageImageData> {
    if (typeof window === "undefined") return {};
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private setStoredImages(data: Record<string, MessageImageData>): void {
    if (typeof window === "undefined") return;
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to store message images:", error);
    }
  }

  storeMessageImages(messageId: string, brokerState: BrokerState): void {
    if (!messageId || !brokerState) return;

    const imageData: MessageImageData = {
      messageId,
      imageUrl: brokerState.image_url,
      userReferenceUrl: brokerState.user_reference_url,
      base64Image: (brokerState as any).base64_image,
      videoUrl: (brokerState as any).video_url,
      imagePrompt: brokerState.image_prompt,
      timestamp: Date.now(),
    };

    if (!imageData.imageUrl && !imageData.userReferenceUrl && !imageData.base64Image && !imageData.videoUrl) {
      return;
    }

    const stored = this.getStoredImages();
    stored[messageId] = imageData;
    this.setStoredImages(stored);
  }

  getMessageImages(messageId: string): MessageImageData | null {
    if (!messageId) return null;
    
    const stored = this.getStoredImages();
    return stored[messageId] || null;
  }

  cleanupOldImages(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const stored = this.getStoredImages();
    const cutoff = Date.now() - maxAge;
    
    const cleaned = Object.fromEntries(
      Object.entries(stored).filter(([_, data]) => data.timestamp > cutoff)
    );
    
    this.setStoredImages(cleaned);
  }

  removeMessageImages(messageId: string): void {
    if (!messageId) return;
    
    const stored = this.getStoredImages();
    delete stored[messageId];
    this.setStoredImages(stored);
  }

  getAllStoredImages(): MessageImageData[] {
    const stored = this.getStoredImages();
    return Object.values(stored).sort((a, b) => b.timestamp - a.timestamp);
  }
}

export const messageImagePersistence = new MessageImagePersistenceManager();

if (typeof window !== "undefined") {
  messageImagePersistence.cleanupOldImages();
}