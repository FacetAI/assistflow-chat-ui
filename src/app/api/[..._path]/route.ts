import { initApiPassthrough } from "langgraph-nextjs-api-passthrough"

// This file acts as a proxy for requests to your LangGraph server.
// Read the [Going to Production](https://github.com/langchain-ai/agent-chat-ui?tab=readme-ov-file#going-to-production) section for more information.

async function _urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)
    
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    
    return `data:${contentType};base64,${base64}`
  } catch (error) {
    console.warn('Failed to convert URL to base64:', error)
    throw error
  }
}

async function _processImageUrls(data: any): Promise<any> {
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
              const base64Url = await _urlToBase64(block.source.url)
              // Convert to base64 format for LLM
              const [, mimeType, base64Data] = base64Url.match(/^data:([^;]+);base64,(.+)$/) || []
              if (mimeType && base64Data) {
                block.source = {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Data,
                }
              }
            } catch (error) {
              console.error(`Failed to convert image URL to base64: ${block.source.url}`, error)
              // Keep original URL as fallback
            }
          }
        }
      }
    }
  }
  
  return data
}

function _shouldConvertToBase64(url: string): boolean {
  const pathname = new URL(url).pathname
  
  // Convert to base64 only for direct LLM inference endpoints
  // Keep URLs for storage, traces, and other operations
  return (
    pathname.includes('/invoke') ||      // Direct LLM calls
    pathname.includes('/stream') ||      // Streaming LLM calls
    pathname.includes('/batch') ||       // Batch LLM calls
    pathname.includes('/astream')        // Async streaming calls
  )
}

function _deepClone(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (Array.isArray(obj)) return obj.map(_deepClone)
  
  const cloned: any = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = _deepClone(obj[key])
    }
  }
  return cloned
}


export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl: process.env.LANGGRAPH_API_URL ?? "remove-me",
    apiKey: process.env.LANGSMITH_API_KEY ?? "remove-me",
    runtime: "edge",
  })
