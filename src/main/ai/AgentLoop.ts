import { LLMProvider, LLMMessage, ToolCall } from './LLMProvider'
import { AgentTools } from './AgentTools'
import { SecurityGuard, SecurityLevel } from './SecurityGuard'

export type AgentMode = 'qa' | 'agent'

export interface AgentEvent {
  type: 'text' | 'thinking' | 'tool-call' | 'tool-result' | 'command-card' | 'confirm-needed' | 'done' | 'error'
  content?: string
  tool?: string
  args?: any
  result?: string
  command?: string
  level?: SecurityLevel
}

export interface ServerContext {
  host: string
  port: number
  username: string
  currentDir: string
  frequentCommands: { command: string; useCount: number; lastUsed: number }[]
  recentOutput?: string
  os?: string
}

export class AgentLoop {
  private llm: LLMProvider
  private tools: AgentTools
  private security: SecurityGuard
  private maxSteps: number
  private abortController: AbortController | null = null

  constructor(
    llm: LLMProvider,
    tools: AgentTools,
    security: SecurityGuard,
    maxSteps: number = 10
  ) {
    this.llm = llm
    this.tools = tools
    this.security = security
    this.maxSteps = maxSteps
  }

  // 终止当前执行
  abort() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  async run(
    userMessage: string,
    mode: AgentMode,
    context: ServerContext,
    chatHistory: LLMMessage[],
    onEvent: (event: AgentEvent) => void
  ): Promise<void> {
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    try {
      const systemPrompt = this.buildSystemPrompt(context, mode)
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
        { role: 'user', content: userMessage },
      ]

      // QA 模式不用 tools
      const tools = mode === 'agent' ? this.tools.getToolDefinitions() : undefined

      for (let step = 0; step < this.maxSteps; step++) {
        if (signal.aborted) {
          onEvent({ type: 'error', content: '已取消' })
          return
        }

        onEvent({ type: 'thinking', content: step === 0 ? '正在思考...' : '继续分析...' })

        let fullText = ''
        const toolCallsToProcess: ToolCall[] = []

        // 流式调用 LLM
        for await (const chunk of this.llm.chatStream(messages, tools, signal)) {
          if (chunk.type === 'text' && chunk.content) {
            fullText += chunk.content
            onEvent({ type: 'text', content: chunk.content })
          }
          if (chunk.type === 'tool_call' && chunk.toolCall) {
            toolCallsToProcess.push(chunk.toolCall)
          }
        }

        // 没有 tool calls → 任务完成（命令已内联到文本中，不再单独列出）
        if (toolCallsToProcess.length === 0) {
          onEvent({ type: 'done' })
          return
        }

        // 有 tool calls → 执行
        messages.push({
          role: 'assistant',
          content: fullText || null,
          tool_calls: toolCallsToProcess,
        })

        for (const toolCall of toolCallsToProcess) {
          if (signal.aborted) {
            onEvent({ type: 'error', content: '已取消' })
            return
          }

          let args: Record<string, any>
          try {
            args = JSON.parse(toolCall.function.arguments)
          } catch {
            onEvent({ type: 'error', content: `工具参数解析失败: ${toolCall.function.arguments}` })
            return
          }

          // 安全检查（仅 agent 模式）
          if (mode === 'agent' && toolCall.function.name === 'executeCommand') {
            const check = this.security.checkCommand(args.command)
            if (check.level === 'critical') {
              onEvent({ type: 'error', content: `拒绝执行: ${check.reason}` })
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `执行被拒绝: ${check.reason}。请换一种安全的方式。`,
              })
              continue
            }
            if (check.level === 'high') {
              onEvent({
                type: 'confirm-needed',
                command: args.command,
                level: check.level,
              })
              // 把待确认的信息存起来，等用户确认后继续
              this.pendingConfirmation = {
                toolCall,
                messages,
                signal,
                onEvent,
                mode,
                context,
              }
              return
            }
          }

          // 执行工具
          onEvent({ type: 'tool-call', tool: toolCall.function.name, args })

          try {
            const result = await this.tools.execute(toolCall.function.name, args)
            const truncated = result.length > 8000 ? result.slice(0, 8000) + '\n...(截断)' : result
            onEvent({ type: 'tool-result', result: truncated })

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: truncated,
            })
          } catch (err) {
            const errorMsg = (err as Error).message
            onEvent({ type: 'tool-result', result: `错误: ${errorMsg}` })

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `执行错误: ${errorMsg}`,
            })
          }
        }
      }

      // 达到步数限制，询问用户是否继续
      onEvent({ type: 'confirm-needed', command: `已执行 ${this.maxSteps} 步，任务可能未完成。是否继续？`, level: 'continue' })
      this.pendingContinue = { messages, mode, context, signal, onEvent }
      return
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('abort') || msg.includes('取消')) {
        onEvent({ type: 'error', content: '已取消' })
      } else {
        onEvent({ type: 'error', content: `Agent 错误: ${msg}` })
      }
    } finally {
      this.abortController = null
      // 如果正在等待用户确认，不要清除 pendingConfirmation
      if (!this.pendingConfirmation) {
        this.pendingConfirmation = null
      }
    }
  }

  // 用户确认后继续执行
  async confirmCommand(confirmed: boolean) {
    const pending = this.pendingConfirmation
    if (!pending) return

    const { toolCall, messages, signal, onEvent, mode, context } = pending
    this.pendingConfirmation = null

    if (!confirmed) {
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: '用户拒绝执行此命令。请换一种方式或给用户解释。',
      })
      // 继续循环，让 LLM 知道用户拒绝了
      await this.continueAfterConfirm(messages, mode, context, signal, onEvent)
      return
    }

    // 用户确认，执行命令
    let args: Record<string, any>
    try {
      args = JSON.parse(toolCall.function.arguments)
    } catch {
      onEvent({ type: 'error', content: '参数解析失败' })
      return
    }

    onEvent({ type: 'tool-call', tool: toolCall.function.name, args })

    try {
      const result = await this.tools.execute(toolCall.function.name, args)
      const truncated = result.length > 2000 ? result.slice(0, 2000) + '\n...(截断)' : result
      onEvent({ type: 'tool-result', result: truncated })

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: truncated,
      })
    } catch (err) {
      onEvent({ type: 'tool-result', result: `错误: ${(err as Error).message}` })
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: `执行错误: ${(err as Error).message}`,
      })
    }

    // 继续循环
    await this.continueAfterConfirm(messages, mode, context, signal, onEvent)
  }

  private pendingConfirmation: {
    toolCall: ToolCall
    messages: LLMMessage[]
    signal: AbortSignal
    onEvent: (event: AgentEvent) => void
    mode: AgentMode
    context: ServerContext
  } | null = null

  hasPendingConfirmation(): boolean {
    return this.pendingConfirmation !== null
  }

  private pendingContinue: {
    messages: LLMMessage[]
    mode: AgentMode
    context: ServerContext
    signal: AbortSignal
    onEvent: (event: AgentEvent) => void
  } | null = null

  hasPendingContinue(): boolean {
    return this.pendingContinue !== null
  }

  // 用户确认继续后，再跑 maxSteps 步
  async confirmContinue(confirmed: boolean) {
    const pending = this.pendingContinue
    if (!pending) return

    if (!confirmed) {
      pending.onEvent({ type: 'error', content: '已停止' })
      this.pendingContinue = null
      return
    }

    this.pendingContinue = null
    const { messages, mode, context, signal, onEvent } = pending
    const tools = mode === 'agent' ? this.tools.getToolDefinitions() : undefined

    for (let step = 0; step < this.maxSteps; step++) {
      if (signal.aborted) {
        onEvent({ type: 'error', content: '已取消' })
        return
      }

      let fullText = ''
      const toolCallsToProcess: ToolCall[] = []

      for await (const chunk of this.llm.chatStream(messages, tools, signal)) {
        if (chunk.type === 'text' && chunk.content) {
          fullText += chunk.content
          onEvent({ type: 'text', content: chunk.content })
        }
        if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolCallsToProcess.push(chunk.toolCall)
        }
      }

      if (toolCallsToProcess.length === 0) {
        if (fullText) {
          const commands = this.extractCommands(fullText)
          for (const cmd of commands) onEvent({ type: 'command-card', command: cmd })
        }
        onEvent({ type: 'done' })
        return
      }

      messages.push({ role: 'assistant', content: fullText || null, tool_calls: toolCallsToProcess })

      for (const toolCall of toolCallsToProcess) {
        if (signal.aborted) { onEvent({ type: 'error', content: '已取消' }); return }

        let args: Record<string, any>
        try { args = JSON.parse(toolCall.function.arguments) } catch { continue }

        if (mode === 'agent' && toolCall.function.name === 'executeCommand') {
          const check = this.security.checkCommand(args.command)
          if (check.level === 'critical') {
            onEvent({ type: 'error', content: `拒绝执行: ${check.reason}` })
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: `执行被拒绝: ${check.reason}` })
            continue
          }
          if (check.level === 'high') {
            onEvent({ type: 'confirm-needed', command: args.command, level: check.level })
            this.pendingConfirmation = { toolCall, messages, signal, onEvent, mode, context }
            return
          }
        }

        onEvent({ type: 'tool-call', tool: toolCall.function.name, args })
        try {
          const result = await this.tools.execute(toolCall.function.name, args)
          const truncated = result.length > 2000 ? result.slice(0, 2000) + '\n...(截断)' : result
          onEvent({ type: 'tool-result', result: truncated })
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: truncated })
        } catch (err) {
          const errorMsg = (err as Error).message
          onEvent({ type: 'tool-result', result: `错误: ${errorMsg}` })
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: `执行错误: ${errorMsg}` })
        }
      }
    }

    // 又到了步数限制，再次询问
    onEvent({ type: 'confirm-needed', command: `又执行了 ${this.maxSteps} 步，是否继续？`, level: 'continue' })
    this.pendingContinue = { messages, mode, context, signal, onEvent }
  }

  private async continueAfterConfirm(
    messages: LLMMessage[],
    mode: AgentMode,
    context: ServerContext,
    signal: AbortSignal,
    onEvent: (event: AgentEvent) => void
  ) {
    const tools = mode === 'agent' ? this.tools.getToolDefinitions() : undefined

    for (let step = 0; step < this.maxSteps; step++) {
      if (signal.aborted) {
        onEvent({ type: 'error', content: '已取消' })
        return
      }

      let fullText = ''
      const toolCallsToProcess: ToolCall[] = []

      for await (const chunk of this.llm.chatStream(messages, tools, signal)) {
        if (chunk.type === 'text' && chunk.content) {
          fullText += chunk.content
          onEvent({ type: 'text', content: chunk.content })
        }
        if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolCallsToProcess.push(chunk.toolCall)
        }
      }

      if (toolCallsToProcess.length === 0) {
        if (fullText) {
          const commands = this.extractCommands(fullText)
          for (const cmd of commands) {
            onEvent({ type: 'command-card', command: cmd })
          }
        }
        onEvent({ type: 'done' })
        return
      }

      messages.push({
        role: 'assistant',
        content: fullText || null,
        tool_calls: toolCallsToProcess,
      })

      for (const toolCall of toolCallsToProcess) {
        let args: Record<string, any>
        try {
          args = JSON.parse(toolCall.function.arguments)
        } catch {
          continue
        }

        if (mode === 'agent' && toolCall.function.name === 'executeCommand') {
          const check = this.security.checkCommand(args.command)
          if (check.level === 'critical') {
            onEvent({ type: 'error', content: `拒绝执行: ${check.reason}` })
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `执行被拒绝: ${check.reason}`,
            })
            continue
          }
          if (check.level === 'high') {
            onEvent({ type: 'confirm-needed', command: args.command, level: check.level })
            this.pendingConfirmation = { toolCall, messages, signal, onEvent, mode, context }
            return
          }
        }

        onEvent({ type: 'tool-call', tool: toolCall.function.name, args })
        try {
          const result = await this.tools.execute(toolCall.function.name, args)
          const truncated = result.length > 2000 ? result.slice(0, 2000) + '\n...(截断)' : result
          onEvent({ type: 'tool-result', result: truncated })
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: truncated })
        } catch (err) {
          const errorMsg = (err as Error).message
          onEvent({ type: 'tool-result', result: `错误: ${errorMsg}` })
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: `执行错误: ${errorMsg}` })
        }
      }
    }

    onEvent({ type: 'done' })
  }

  // 从 LLM 文字输出中提取 ```command 代码块
  private extractCommands(text: string): string[] {
    const commands: string[] = []
    const regex = /```(?:command|bash|sh)?\s*\n([\s\S]*?)```/g
    let match
    while ((match = regex.exec(text)) !== null) {
      const block = match[1].trim()
      // 可能包含多行命令
      const lines = block.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'))
      for (const line of lines) {
        // 去掉开头的 $ 或 >
        const cleaned = line.replace(/^\s*[$>]\s*/, '').trim()
        if (cleaned) commands.push(cleaned)
      }
    }
    return commands
  }

  private buildSystemPrompt(context: ServerContext, mode: AgentMode): string {
    const freqCommands = context.frequentCommands
      .slice(0, 30)
      .map((c) => `- "${c.command}" (使用 ${c.useCount} 次)`)
      .join('\n')

    const base = `你是一个服务器运维助手，当前连接到 ${context.host}（${context.username}@${context.currentDir}）。

## 服务器命令历史
用户在这台服务器上执行过的高频命令：
${freqCommands || '(暂无)'}

## 当前工作目录
${context.currentDir}
${context.os ? `\n## 系统信息\n${context.os}` : ''}`

    if (mode === 'qa') {
      return `${base}

## 你的角色
你是一个知识丰富的运维顾问。用户会问你关于 Linux、服务器、命令等问题。
- 直接回答问题，不要执行任何命令
- 解释要简洁清晰，用中文回答
- 如果涉及命令，用代码块展示并解释每个部分
- 如果用户提供了错误信息，分析原因并给出修复建议`
    }

    return `${base}

## 你的角色
你是一个服务器运维智能体。你可以使用工具来查询服务器信息、执行操作。

## 核心原则
- **能直接回答的就直接回答**，不要为了"确认"而执行不必要的命令
- 只有当用户的任务确实需要查询服务器信息时才使用工具
- 如果用户问的是概念性问题、命令解释、错误分析，直接回答即可
- 如果需要找到某个文件/项目/服务的位置，才去执行搜索命令
- 历史命令已经是你的知识，不需要再跑命令去"验证"

## 使用工具的场景
- "帮我启动 xxx" → 需要查找项目位置、确认启动方式
- "看看磁盘用了多少" → 需要执行 df 命令
- "nginx 怎么了" → 需要查看 nginx 状态和日志
- "清理磁盘" → 需要先查看哪些目录占用大

## 不需要使用工具的场景
- "解释一下 awk 命令" → 直接回答
- "rm -rf 是什么意思" → 直接回答
- "怎么配置 SSH" → 直接回答
- 用户粘贴了错误信息让你分析 → 直接分析

## 规则
- 查询类命令可以直接执行，修改类命令前要告知用户
- 用中文回复，简洁直接
- 如果从历史命令中能找到答案，优先使用，不要重复查询
- 如果不知道项目或者文件位置，可以先询问用户，得不到答案再自己去查找`

  }
}
