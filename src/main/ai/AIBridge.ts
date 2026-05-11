import { BrowserWindow } from 'electron'
import { LLMProvider, LLMMessage } from './LLMProvider'
import { AgentTools } from './AgentTools'
import { SecurityGuard } from './SecurityGuard'
import { AgentLoop, AgentEvent, ServerContext } from './AgentLoop'
import { SSHClient } from '../ssh/SSHClient'

export interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export class AIBridge {
  private llm: LLMProvider | null = null
  private tools = new AgentTools()
  private security = new SecurityGuard()
  private agents = new Map<string, AgentLoop>() // tabId → AgentLoop
  private config: AIConfig | null = null

  configure(config: AIConfig) {
    this.config = config
    this.llm = new LLMProvider(config)
  }

  getConfig(): AIConfig | null {
    return this.config
  }

  isConfigured(): boolean {
    return !!(this.config?.baseUrl && this.config?.model)
  }

  setSSHClient(_tabId: string, client: SSHClient) {
    this.tools.setSSHClient(client)
  }

  async testConnection(config: AIConfig): Promise<{ success: boolean; message: string }> {
    const provider = new LLMProvider(config)
    return provider.testConnection()
  }

  // 智能问答
  async askQuestion(
    tabId: string,
    question: string,
    context: ServerContext,
    history: LLMMessage[],
    win: BrowserWindow
  ) {
    if (!this.llm) throw new Error('AI 未配置')

    const agent = new AgentLoop(this.llm, this.tools, this.security, 5)
    this.agents.set(tabId, agent)

    await agent.run(question, 'qa', context, history, (event: AgentEvent) => {
      win.webContents.send('ai:event', { tabId, event })
    })

    this.agents.delete(tabId)
  }

  // 智能体执行
  async runAgent(
    tabId: string,
    message: string,
    context: ServerContext,
    history: LLMMessage[],
    win: BrowserWindow
  ) {
    if (!this.llm) throw new Error('AI 未配置')

    const agent = new AgentLoop(this.llm, this.tools, this.security, 10)
    this.agents.set(tabId, agent)

    await agent.run(message, 'agent', context, history, (event: AgentEvent) => {
      win.webContents.send('ai:event', { tabId, event })
    })

    // 如果 agent 还在等待确认，不要删除
    // confirmCommand 结束后会自动清理
  }

  // 用户确认命令后继续
  async confirmCommand(tabId: string, confirmed: boolean) {
    const agent = this.agents.get(tabId)
    if (agent) {
      await agent.confirmCommand(confirmed)
      // 确认流程结束后，如果没有更多等待，清理 agent
      if (!agent.hasPendingConfirmation()) {
        this.agents.delete(tabId)
      }
    }
  }

  // 用户确认继续执行（步数超限后）
  async confirmContinue(tabId: string, confirmed: boolean) {
    const agent = this.agents.get(tabId)
    if (agent) {
      await agent.confirmContinue(confirmed)
      if (!agent.hasPendingContinue() && !agent.hasPendingConfirmation()) {
        this.agents.delete(tabId)
      }
    }
  }

  // 取消当前执行
  cancel(tabId: string) {
    const agent = this.agents.get(tabId)
    if (agent) {
      agent.abort()
      this.agents.delete(tabId)
    }
  }
}
