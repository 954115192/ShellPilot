import { Session, SessionConfig } from './Session'
import { CryptoHelper } from './CryptoHelper'
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
  authType?: string
  keyId?: string
  groupId?: string
  createdAt: number
  lastConnected?: number
}

export interface SessionGroup {
  id: string
  name: string
  order: number
}

export class SessionManager {
  private sessions: Map<string, Session>
  private config: SessionManagerConfig
  private nextId: number
  private sessionsFile: string
  private groupsFile: string

  constructor(config?: SessionManagerConfig) {
    this.sessions = new Map()
    this.config = config || { maxConcurrentSessions: 10, sessionTimeout: 3600 }
    this.nextId = 0

    const userDataPath = app.getPath('userData')
    this.sessionsFile = path.join(userDataPath, 'sessions.json')
    this.groupsFile = path.join(userDataPath, 'session-groups.json')

    this.loadSessions()
    this.migratePlaintextPasswords()
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

  private migratePlaintextPasswords(): void {
    try {
      if (!fs.existsSync(this.sessionsFile)) return
      if (!CryptoHelper.isAvailable()) return

      const data = fs.readFileSync(this.sessionsFile, 'utf-8')
      const sessions: SavedSession[] = JSON.parse(data)
      let migrated = false

      for (const s of sessions) {
        if (s.password && !CryptoHelper.isEncrypted(s.password)) {
          s.password = CryptoHelper.encrypt(s.password)
          migrated = true
        }
      }

      if (migrated) {
        fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8')
        console.log('[SessionManager] Migrated plaintext passwords to encrypted storage')
      }
    } catch (error) {
      console.error('[SessionManager] Failed to migrate passwords:', error)
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

  getSavedSessionsDecrypted(): SavedSession[] {
    const sessions = this.getSavedSessions()
    for (const s of sessions) {
      if (s.password) s.password = CryptoHelper.decrypt(s.password)
    }
    return sessions
  }

  getSavedSessionDecrypted(id: string): SavedSession | undefined {
    const sessions = this.getSavedSessions()
    const session = sessions.find(s => s.id === id)
    if (session?.password) session.password = CryptoHelper.decrypt(session.password)
    return session
  }

  saveSessionToHistory(config: { name: string; remark?: string; host: string; port: number; username: string; password?: string; authType?: string; keyId?: string; groupId?: string }): void {
    try {
      const sessions = this.getSavedSessions()
      const existing = sessions.find(s => s.host === config.host && s.username === config.username)
      if (existing) {
        existing.lastConnected = Date.now()
        existing.name = config.name
        if (config.remark !== undefined) existing.remark = config.remark
        if (config.authType !== undefined) existing.authType = config.authType
        if (config.keyId !== undefined) existing.keyId = config.keyId
        if (config.groupId !== undefined) existing.groupId = config.groupId
        if (config.password) existing.password = CryptoHelper.encrypt(config.password)
      } else {
        sessions.push({
          id: String(Date.now()),
          name: config.name,
          remark: config.remark,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password ? CryptoHelper.encrypt(config.password) : undefined,
          authType: config.authType,
          keyId: config.keyId,
          groupId: config.groupId,
          createdAt: Date.now(),
          lastConnected: Date.now()
        })
      }
      fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8')
    } catch (error) {
      console.error('[SessionManager] Failed to save session to history:', error)
    }
  }

  updateSavedSession(id: string, data: { name: string; remark?: string; host: string; port: number; username: string; password?: string; authType?: string; keyId?: string; groupId?: string }): void {
    try {
      const sessions = this.getSavedSessions()
      const session = sessions.find(s => s.id === id)
      if (session) {
        session.name = data.name
        session.remark = data.remark
        session.host = data.host
        session.port = data.port
        session.username = data.username
        if (data.authType !== undefined) session.authType = data.authType
        if (data.keyId !== undefined) session.keyId = data.keyId
        if (data.groupId !== undefined) session.groupId = data.groupId
        if (data.password) session.password = CryptoHelper.encrypt(data.password)
        fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8')
      }
    } catch (error) {
      console.error('[SessionManager] Failed to update session:', error)
    }
  }

  deleteSavedSession(id: string): void {
    try {
      const sessions = this.getSavedSessions().filter(s => s.id !== id)
      fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8')
    } catch (error) {
      console.error('[SessionManager] Failed to delete session:', error)
    }
  }

  closeAll(): void {
    this.sessions.forEach((session) => session.disconnect())
    this.sessions.clear()
  }

  // --- Group management ---

  getGroups(): SessionGroup[] {
    try {
      if (fs.existsSync(this.groupsFile)) {
        return JSON.parse(fs.readFileSync(this.groupsFile, 'utf-8'))
      }
    } catch (e) {
      console.error('[SessionManager] Failed to read groups:', e)
    }
    return []
  }

  createGroup(name: string): SessionGroup {
    const groups = this.getGroups()
    const group: SessionGroup = { id: 'g-' + Date.now(), name, order: groups.length }
    groups.push(group)
    this.saveGroups(groups)
    return group
  }

  updateGroup(id: string, data: { name?: string; order?: number }): void {
    const groups = this.getGroups()
    const g = groups.find(x => x.id === id)
    if (g) {
      if (data.name !== undefined) g.name = data.name
      if (data.order !== undefined) g.order = data.order
      this.saveGroups(groups)
    }
  }

  deleteGroup(id: string): void {
    this.saveGroups(this.getGroups().filter(g => g.id !== id))
    // Unassign sessions from deleted group
    const sessions = this.getSavedSessions()
    let changed = false
    for (const s of sessions) {
      if (s.groupId === id) { s.groupId = undefined; changed = true }
    }
    if (changed) {
      fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8')
    }
  }

  private saveGroups(groups: SessionGroup[]): void {
    try {
      fs.writeFileSync(this.groupsFile, JSON.stringify(groups, null, 2), 'utf-8')
    } catch (e) {
      console.error('[SessionManager] Failed to save groups:', e)
    }
  }
}
