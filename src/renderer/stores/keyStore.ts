import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface SSHKey {
  id: string
  name: string
  privateKey: string
  passphrase?: string
}

const STORAGE_KEY = 'shell-app-ssh-keys'

function loadKeys(): SSHKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

export const useKeyStore = defineStore('keys', () => {
  const keys = ref<SSHKey[]>(loadKeys())

  function saveKeys() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys.value))
  }

  function addKey(key: Omit<SSHKey, 'id'>) {
    keys.value.push({
      ...key,
      id: 'key-' + Date.now(),
    })
    saveKeys()
  }

  function updateKey(id: string, data: Partial<SSHKey>) {
    const idx = keys.value.findIndex(k => k.id === id)
    if (idx >= 0) {
      keys.value[idx] = { ...keys.value[idx], ...data }
      saveKeys()
    }
  }

  function deleteKey(id: string) {
    keys.value = keys.value.filter(k => k.id !== id)
    saveKeys()
  }

  function getKeyById(id: string): SSHKey | undefined {
    return keys.value.find(k => k.id === id)
  }

  return {
    keys,
    addKey,
    updateKey,
    deleteKey,
    getKeyById,
  }
})
