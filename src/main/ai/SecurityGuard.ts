export type SecurityLevel = 'low' | 'medium' | 'high' | 'critical' | 'continue'

export interface SecurityResult {
  safe: boolean
  level: SecurityLevel
  reason?: string
}

// 危险命令 — 直接拒绝
const CRITICAL_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\brm\s+(-[a-zA-Z]*[rf]+\s+)?\/\s*$/, reason: '删除根目录' },
  { pattern: /\brm\s+(-[a-zA-Z]*[rf]+\s+)?\/\*/, reason: '删除根目录所有文件' },
  { pattern: /\bdd\s+if=.*of=\/dev\/sd/, reason: 'dd 覆写磁盘' },
  { pattern: /\bmkfs\b/, reason: '格式化磁盘' },
  { pattern: /:(){ :\|:& };:/, reason: 'fork bomb' },
  { pattern: />\s*\/dev\/sd[a-z]/, reason: '覆写磁盘设备' },
  { pattern: /\bchmod\s+(-R\s+)?777\s+\/\s*$/, reason: '根目录 777 权限' },
]

// 需要用户确认的命令
const HIGH_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\brm\b/, reason: '删除文件' },
  { pattern: /\bkill\b/, reason: '终止进程' },
  { pattern: /\bpkill\b/, reason: '终止进程' },
  { pattern: /\bsystemctl\s+(stop|restart|disable)\b/, reason: '服务操作' },
  { pattern: /\bservice\s+\S+\s+(stop|restart)\b/, reason: '服务操作' },
  { pattern: /\bchmod\b/, reason: '修改权限' },
  { pattern: /\bchown\b/, reason: '修改所有者' },
  { pattern: /\buserdel\b/, reason: '删除用户' },
  { pattern: /\buseradd\b/, reason: '添加用户' },
  { pattern: /\biptables\b/, reason: '防火墙规则' },
  { pattern: /\breboot\b/, reason: '重启服务器' },
  { pattern: /\bshutdown\b/, reason: '关机' },
  { pattern: /\binit\s+[06]\b/, reason: '关机/重启' },
  { pattern: /\bcrontab\s+-r\b/, reason: '清除定时任务' },
  { pattern: /\bdrop\s+(database|table)\b/i, reason: '删除数据库/表' },
  { pattern: /\btruncate\s+table\b/i, reason: '清空表数据' },
]

// 中等风险 — 显示警告
const MEDIUM_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bcp\b.*\b(-r|--recursive)\b/, reason: '递归复制' },
  { pattern: /\bmv\b/, reason: '移动/重命名文件' },
  { pattern: /\bmkdir\b/, reason: '创建目录' },
  { pattern: /\btouch\b/, reason: '创建文件' },
  { pattern: /\bapt(-get)?\s+(install|remove|purge)\b/, reason: '包管理操作' },
  { pattern: /\byum\s+(install|remove|erase)\b/, reason: '包管理操作' },
  { pattern: /\bdnf\s+(install|remove)\b/, reason: '包管理操作' },
  { pattern: /\bpip\s+(install|uninstall)\b/, reason: 'Python 包管理' },
  { pattern: /\bnpm\s+(install|uninstall)\s+-g\b/, reason: '全局 npm 包管理' },
  { pattern: /\bdocker\s+(rm|rmi|stop|kill)\b/, reason: 'Docker 操作' },
]

export class SecurityGuard {
  checkCommand(command: string): SecurityResult {
    const trimmed = command.trim()
    if (!trimmed) return { safe: true, level: 'low' }

    // 检查危险命令
    for (const { pattern, reason } of CRITICAL_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { safe: false, level: 'critical', reason: `危险操作: ${reason}` }
      }
    }

    // 检查高风险命令
    for (const { pattern, reason } of HIGH_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { safe: false, level: 'high', reason }
      }
    }

    // 检查中等风险
    for (const { pattern, reason } of MEDIUM_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { safe: true, level: 'medium', reason }
      }
    }

    return { safe: true, level: 'low' }
  }
}
