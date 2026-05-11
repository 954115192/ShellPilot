export interface SessionConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  timeout: number
  retryCount: number
}

export interface SSHConfig extends SessionConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  timeout: number
  retryCount: number
}

export interface CommandResult {
  success: boolean
  output: string
  error?: string
}

export interface ServerStats {
  cpu: {
    usage: number
    loadAverage: number[]
    cores: number
  }
  memory: {
    total: number
    used: number
    free: number
    usage: number
  }
  disk: Array<{
    path: string
    total: number
    used: number
    free: number
    usage: number
  }>
  network: {
    rxBytes: number
    txBytes: number
    rxErrors: number
    txErrors: number
    interface: string
  }
  uptime: number
  processes: number
}
