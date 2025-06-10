/**
 * Client-side image caching utility for message blocks
 * Caches images in IndexedDB for persistence across browser sessions
 */

import React from 'react';

interface CachedImage {
  url: string;
  blob: Blob;
  timestamp: number;
  messageId?: string;
}

const DB_NAME = 'AssistFlowImageCache';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

class ImageCacheManager {
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('messageId', 'messageId', { unique: false });
        }
      };
    });
  }

  async cacheImage(url: string, messageId?: string): Promise<string> {
    try {
      await this.init();
      if (!this.db) throw new Error('Database not initialized');

      // Check if already cached
      const cached = await this.getCachedImage(url);
      if (cached) {
        return cached;
      }

      // Fetch and cache the image
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

      const blob = await response.blob();
      const cachedImage: CachedImage = {
        url,
        blob,
        timestamp: Date.now(),
        messageId,
      };

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const request = store.put(cachedImage);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return URL.createObjectURL(blob);
    } catch (error) {
      console.warn('Failed to cache image:', error);
      return url; // Return original URL on failure
    }
  }

  async getCachedImage(url: string): Promise<string | null> {
    try {
      await this.init();
      if (!this.db) return null;

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise<string | null>((resolve) => {
        const request = store.get(url);
        request.onsuccess = () => {
          const result = request.result as CachedImage | undefined;
          if (result) {
            // Check if cache is still valid
            if (Date.now() - result.timestamp < CACHE_EXPIRY) {
              resolve(URL.createObjectURL(result.blob));
            } else {
              // Cache expired, remove it
              this.removeCachedImage(url);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      console.warn('Failed to get cached image:', error);
      return null;
    }
  }

  async removeCachedImage(url: string): Promise<void> {
    try {
      await this.init();
      if (!this.db) return;

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(url);
    } catch (error) {
      console.warn('Failed to remove cached image:', error);
    }
  }

  async clearExpiredCache(): Promise<void> {
    try {
      await this.init();
      if (!this.db) return;

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const cutoff = Date.now() - CACHE_EXPIRY;

      const request = index.openCursor(IDBKeyRange.upperBound(cutoff));
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    } catch (error) {
      console.warn('Failed to clear expired cache:', error);
    }
  }

  async getCacheSize(): Promise<number> {
    try {
      await this.init();
      if (!this.db) return 0;

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise<number>((resolve) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
    } catch (error) {
      console.warn('Failed to get cache size:', error);
      return 0;
    }
  }

  /**
   * Convert image URL to base64 data URI for LLM consumption
   * Uses caching to avoid repeated downloads
   */
  async urlToBase64(url: string): Promise<string> {
    try {
      await this.init();
      if (!this.db) throw new Error('Database not initialized');

      // Check if already cached
      const cached = await this.getCachedImageBlob(url);
      let blob: Blob;

      if (cached) {
        blob = cached;
      } else {
        // Fetch and cache the image
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

        blob = await response.blob();
        
        // Cache the blob
        const cachedImage: CachedImage = {
          url,
          blob,
          timestamp: Date.now(),
        };

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        await new Promise<void>((resolve, reject) => {
          const request = store.put(cachedImage);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      // Convert blob to base64
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('Failed to convert URL to base64:', error);
      throw error;
    }
  }

  private async getCachedImageBlob(url: string): Promise<Blob | null> {
    try {
      await this.init();
      if (!this.db) return null;

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise<Blob | null>((resolve) => {
        const request = store.get(url);
        request.onsuccess = () => {
          const result = request.result as CachedImage | undefined;
          if (result) {
            // Check if cache is still valid
            if (Date.now() - result.timestamp < CACHE_EXPIRY) {
              resolve(result.blob);
            } else {
              // Cache expired, remove it
              this.removeCachedImage(url);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      console.warn('Failed to get cached image blob:', error);
      return null;
    }
  }
}

// Create singleton instance
export const imageCache = new ImageCacheManager();

// Utility hook for React components
export function useCachedImage(url: string | null, messageId?: string) {
  const [cachedUrl, setCachedUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!url) {
      setCachedUrl(null);
      return;
    }

    // If it's already a blob URL, use it directly
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      setCachedUrl(url);
      return;
    }

    setIsLoading(true);
    imageCache.cacheImage(url, messageId)
      .then(setCachedUrl)
      .catch(() => setCachedUrl(url)) // Fallback to original URL
      .finally(() => setIsLoading(false));
  }, [url, messageId]);

  return { cachedUrl, isLoading };
}

// Clean up expired cache on app startup
if (typeof window !== 'undefined') {
  imageCache.clearExpiredCache();
}