import { net } from 'electron'

export interface LLMConfig {
  baseUrl: string    // API 地址
  apiKey: string     // API Key
  model: string      // 模型名
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required: string[]
    }
  }
}

export interface LLMResponse {
  content: string | null
  tool_calls: ToolCall[]
}

export class LLMProvider {
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  updateConfig(config: LLMConfig) {
    this.config = config
  }

  // 流式调用 LLM
  async *chatStream(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    signal?: AbortSignal
  ): AsyncGenerator<{ type: 'text' | 'tool_call'; content?: string; toolCall?: ToolCall }> {
    const body: any = {
      model: this.config.model,
      messages,
      stream: true,
    }

    if (tools && tools.length > 0) {
      body.tools = tools
    }

    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`

    const response = await this.httpRequest(url, body, signal)

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const errorText = await this.readStream(response)
      throw new Error(`LLM API 错误 (${response.statusCode}): ${errorText}`)
    }

    // 解析 SSE 流
    yield* this.parseSSEStream(response)
  }

  // 非流式调用（测试连接用）
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const body = {
        model: this.config.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 10,
      }

      const url = `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`
      const response = await this.httpRequest(url, body)

      if (!response.ok) {
        const errorText = await this.readStream(response)
        return { success: false, message: `HTTP ${response.statusCode}: ${errorText}` }
      }

      return { success: true, message: '连接成功' }
    } catch (err) {
      return { success: false, message: (err as Error).message }
    }
  }

  private httpRequest(url: string, body: any, signal?: AbortSignal): Promise<any> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`
      }

      const request = net.request({
        method: 'POST',
        url,
      })

      for (const [key, value] of Object.entries(headers)) {
        request.setHeader(key, value)
      }

      if (signal) {
        signal.addEventListener('abort', () => {
          request.abort()
          reject(new Error('请求已取消'))
        })
      }

      request.on('response', (response) => {
        resolve(response)
      })

      request.on('error', (err) => {
        reject(new Error(`网络请求失败: ${err.message}`))
      })

      request.write(JSON.stringify(body))
      request.end()
    })
  }

  private readStream(response: any): Promise<string> {
    return new Promise((resolve) => {
      let data = ''
      response.on('data', (chunk: Buffer) => {
        data += chunk.toString()
      })
      response.on('end', () => resolve(data))
    })
  }

  private async *parseSSEStream(
    response: any
  ): AsyncGenerator<{ type: 'text' | 'tool_call'; content?: string; toolCall?: ToolCall }> {
    let buffer = ''
    // 用于累积 tool_call 的参数
    const toolCallBuffers = new Map<number, { id: string; name: string; arguments: string }>()

    for await (const chunk of response) {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta
          if (!delta) continue

          // 文字内容
          if (delta.content) {
            yield { type: 'text', content: delta.content }
          }

          // tool_calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!toolCallBuffers.has(idx)) {
                toolCallBuffers.set(idx, { id: '', name: '', arguments: '' })
              }
              const buf = toolCallBuffers.get(idx)!

              if (tc.id) buf.id = tc.id
              if (tc.function?.name) buf.name = tc.function.name
              if (tc.function?.arguments) buf.arguments += tc.function.arguments
            }
          }

          // finish_reason 为 tool_calls 时，输出完整的 tool call
          if (parsed.choices?.[0]?.finish_reason === 'tool_calls') {
            for (const [idx, buf] of toolCallBuffers) {
              yield {
                type: 'tool_call',
                toolCall: {
                  id: buf.id || `call_${idx}`,
                  type: 'function',
                  function: { name: buf.name, arguments: buf.arguments },
                },
              }
            }
            toolCallBuffers.clear()
          }
        } catch {}
      }
    }
  }
}
