import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";
import { NextRequest } from "next/server";

// This file acts as a proxy for requests to your LangGraph server.
// Read the [Going to Production](https://github.com/langchain-ai/agent-chat-ui?tab=readme-ov-file#going-to-production) section for more information.

/**
 * Convert image URL to base64 data URI for LLM consumption
 */
async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.warn('Failed to convert URL to base64:', error);
    throw error;
  }
}

/**
 * Process messages to convert image URLs to base64 format for LLM compatibility
 */
async function processImageUrls(data: any): Promise<any> {
  if (!data || typeof data !== 'object') return data;
  
  // Process messages array if it exists
  if (Array.isArray(data.messages)) {
    for (const message of data.messages) {
      if (message.content && Array.isArray(message.content)) {
        for (const block of message.content) {
          // Convert image blocks with URL source to base64 (Anthropic format)
          if (block.type === 'image' && 
              block.source && 
              block.source.type === 'url' && 
              block.source.url && 
              !block.source.url.startsWith('data:')) {
            try {
              const base64Url = await urlToBase64(block.source.url);
              // Convert to base64 format for LLM
              const [, mimeType, base64Data] = base64Url.match(/^data:([^;]+);base64,(.+)$/) || [];
              if (mimeType && base64Data) {
                block.source = {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Data,
                };
              }
            } catch (error) {
              console.error(`Failed to convert image URL to base64: ${block.source.url}`, error);
              // Keep original URL as fallback
            }
          }
        }
      }
    }
  }
  
  return data;
}

/**
 * Check if the request is for LLM inference (where we need base64)
 * vs storage/retrieval (where we want to keep URLs)
 */
function shouldConvertToBase64(url: string): boolean {
  const pathname = new URL(url).pathname;
  
  // Convert to base64 only for direct LLM inference endpoints
  // Keep URLs for storage, traces, and other operations
  return (
    pathname.includes('/invoke') ||      // Direct LLM calls
    pathname.includes('/stream') ||      // Streaming LLM calls
    pathname.includes('/batch') ||       // Batch LLM calls
    pathname.includes('/astream')        // Async streaming calls
  );
}

/**
 * Create a deep copy of data to avoid mutating the original
 */
function deepClone(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(deepClone);
  
  const cloned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Custom request transformer to handle image URL conversion only for LLM calls
 */
const requestTransformer = async (request: NextRequest) => {
  // Only process POST requests
  if (request.method !== 'POST') return request;
  
  // Only convert to base64 for LLM inference endpoints
  if (!shouldConvertToBase64(request.url)) return request;
  
  try {
    const body = await request.json();
    // Create a deep copy to avoid mutating the original data
    const processedBody = deepClone(body);
    await processImageUrls(processedBody);
    
    // Create new request with processed body
    return new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(processedBody),
    });
  } catch (error) {
    console.warn('Failed to process request body for image conversion:', error);
    return request; // Return original request on error
  }
};

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl: process.env.LANGGRAPH_API_URL ?? "remove-me", // default, if not defined it will attempt to read process.env.LANGGRAPH_API_URL
    apiKey: process.env.LANGSMITH_API_KEY ?? "remove-me", // default, if not defined it will attempt to read process.env.LANGSMITH_API_KEY
    runtime: "edge", // default
    requestTransformer,
  });
