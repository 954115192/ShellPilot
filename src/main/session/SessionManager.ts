import { Session, SessionConfig } from './Session'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface SessionManagerConfig {
  maxConcurrentSessions: number
  sessionTimeout: number
}

export interface SavedSession {
  id: string
  name: string
  remark?: string
  host: string
  port: number
  username: string
  password?: string
  createdAt: number
  lastConnected?: number
}

export class SessionManager {
  private sessions: Map<string, Session>
  private config: SessionManagerConfig
  private nextId: number
  private sessionsFile: string

  constructor(config?: SessionManagerConfig) {
    this.sessions = new Map()
    this.config = config || { maxConcurrentSessions: 10, sessionTimeout: 3600 }
    this.nextId = 0
    
    // 会话文件路径
    const userDataPath = app.getPath('userData')
    this.sessionsFile = path.join(userDataPath, 'sessions.json')
    
    // 加载已保存的会话
    this.loadSessions()
  }

  private loadSessions(): void {
    try {
      if (fs.existsSync(this.sessionsFile)) {
        const data = fs.readFileSync(this.sessionsFile, 'utf-8')
        const savedSessions: SavedSession[] = JSON.parse(data)
        console.log(`[SessionManager] Loaded ${savedSessions.length} saved sessions`)
      }
    } catch (error) {
      console.error('[SessionManager] Failed to load sessions:', error)
    }
  }

  private saveSessions(): void {
    try {
      const savedSessions: SavedSession[] = Array.from(this.sessions.values()).map(session => ({
        id: session.id,
        name: session.config.host,
        host: session.config.host,
        port: session.config.port,
        username: session.config.username,
        createdAt: Date.now(),
        lastConnected: Date.now()
      }))
      
      fs.writeFileSync(this.sessionsFile, JSON.stringify(savedSessions, null, 2), 'utf-8')
      console.log(`[SessionManager] Saved ${savedSessions.length} sessions`)
    } catch (error) {
      console.error('[SessionManager] Failed to save sessions:', error)
    }
  }

  async createSession(config: SessionConfig): Promise<Session> {
    const session = new Session(config)
    await session.connect()
    this.sessions.set(session.id, session)
    
    // 保存会话
    this.saveSessions()
    
    return session
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  removeSession(id: string): boolean {
    return this.sessions.delete(id)
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values())
  }

  getSavedSessions(): SavedSession[] {
    try {
      if (fs.existsSync(this.sessionsFile)) {
        const data = fs.readFileSync(this.sessionsFile, 'utf-8')
        return JSON.parse(data)
      }
    } catch (error) {
      console.error('[SessionManager] Failed to read saved sessions:', error)
    }
    return []
  }

  /** 保存一条新的连接历史。如果 host+username 已存在则更新时间和密码 */
  saveSessionToHistory(config: { name: string; remark?: string; host: string; port: number; username: string; password?: string }): void {
    try {
      const sessions = this.getSavedSessions()
      const existing = sessions.find(s => s.host === config.host && s.username === config.username)
      if (existing) {
        existing.lastConnected = Date.now()
        existing.name = config.name
        if (config.remark !== undefined) existing.remark = config.remark
        if (config.password) existing.password = config.password
      } else {
        sessions.push({
          id: String(Date.now()),
          name: config.name,
          remark: config.remark,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          createdAt: Date.now(),
          lastConnected: Date.now()
        })
      }
      fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8')
    } catch (error) {
      console.error('[SessionManager] Failed to save session to history:', error)
    }
  }

  /** 更新一条已保存的连接历史 */
  updateSavedSession(id: string, data: { name: string; remark?: string; host: string; port: number; username: string; password?: string }): void {
    try {
      const sessions = this.getSavedSessions()
      const session = sessions.find(s => s.id === id)
      if (session) {
        session.name = data.name
        session.remark = data.remark
        session.host = data.host
        session.port = data.port
        session.username = data.username
        if (data.password) session.password = data.password
        fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8')
      }
    } catch (error) {
      console.error('[SessionManager] Failed to update session:', error)
    }
  }

  /** 删除一条已保存的连接历史 */
  deleteSavedSession(id: string): void {
    try {
      const sessions = this.getSavedSessions().filter(s => s.id !== id)
      fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8')
    } catch (error) {
      console.error('[SessionManager] Failed to delete saved session:', error)
    }
  }

  closeAll(): void {
    this.sessions.forEach((session) => session.disconnect())
    this.sessions.clear()
  }
}
