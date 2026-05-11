import { SSHClient } from '../ssh/SSHClient'

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

// Agent 可用的工具定义
export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'executeCommand',
      description: '在远程服务器上执行 shell 命令并返回输出。用于查询信息、探索系统状态。',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: '要执行的 shell 命令' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readFile',
      description: '读取远程服务器上的文件内容。用于查看配置文件、脚本等。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件的绝对路径' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listDirectory',
      description: '列出远程服务器上指定目录的内容。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目录路径' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchFiles',
      description: '在远程服务器上搜索文件。',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: '文件名模式（支持通配符）' },
          path: { type: 'string', description: '搜索起始路径，默认 /' },
        },
        required: ['pattern'],
      },
    },
  },
]

export class AgentTools {
  private sshClient: SSHClient | null = null

  setSSHClient(client: SSHClient) {
    this.sshClient = client
  }

  getToolDefinitions(): ToolDefinition[] {
    return AGENT_TOOLS
  }

  async execute(name: string, args: Record<string, any>): Promise<string> {
    if (!this.sshClient) {
      throw new Error('SSH 未连接')
    }

    const timeout = 30000 // 30 秒超时

    switch (name) {
      case 'executeCommand': {
        const result = await Promise.race([
          this.sshClient.executeCommand(args.command),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('命令执行超时 (30s)')), timeout)
          ),
        ])
        return result || '(无输出)'
      }

      case 'readFile': {
        const content = await Promise.race([
          this.sshClient.executeCommand(`cat "${args.path}"`),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('读取超时 (30s)')), timeout)
          ),
        ])
        return content || '(空文件)'
      }

      case 'listDirectory': {
        const files = await this.sshClient.listDirectory(args.path)
        if (files.length === 0) return '(空目录)'
        return files
          .map((f) => {
            const type = f.attrs.isDirectory ? 'd' : '-'
            const size = f.attrs.size
            return `${type} ${size.toString().padStart(10)} ${f.filename}`
          })
          .join('\n')
      }

      case 'searchFiles': {
        const searchPath = args.path || '/'
        const result = await Promise.race([
          this.sshClient.executeCommand(
            `find "${searchPath}" -name "${args.pattern}" -maxdepth 5 2>/dev/null | head -30`
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('搜索超时 (30s)')), timeout)
          ),
        ])
        return result || '(未找到)'
      }

      default:
        throw new Error(`未知工具: ${name}`)
    }
  }
}
