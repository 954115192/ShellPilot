import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface SearchColors {
  matchBackground: string
  matchBorder: string
  activeMatchBackground: string
  activeMatchBorder: string
}

export type ThemeMode = 'dark' | 'light' | 'system'

export interface TerminalTheme {
  name: string
  foreground: string
  background: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  selectionForeground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export const TERMINAL_PRESETS: Record<string, TerminalTheme> = {
  default: {
    name: '默认',
    foreground: '#e0e0e0', background: '#1e1e1e', cursor: '#ffffff', cursorAccent: '#1e1e1e',
    selectionBackground: 'rgba(255, 255, 255, 0.15)', selectionForeground: '#ffffff',
    black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
    blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
    brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b', brightYellow: '#f5f543',
    brightBlue: '#3b8eea', brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#ffffff',
  },
  monokai: {
    name: 'Monokai',
    foreground: '#e6db74', background: '#272822', cursor: '#f8f8f0', cursorAccent: '#272822',
    selectionBackground: 'rgba(255, 255, 255, 0.1)', selectionForeground: '#f8f8f2',
    black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#f4bf75',
    blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2',
    brightBlack: '#75715e', brightRed: '#f92672', brightGreen: '#a6e22e', brightYellow: '#f4bf75',
    brightBlue: '#66d9ef', brightMagenta: '#ae81ff', brightCyan: '#a1efe4', brightWhite: '#f9f8f5',
  },
  dracula: {
    name: 'Dracula',
    foreground: '#a4ffff', background: '#282a36', cursor: '#f8f8f2', cursorAccent: '#282a36',
    selectionBackground: 'rgba(68, 71, 90, 0.7)', selectionForeground: '#f8f8f2',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
    brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff',
  },
  solarizedDark: {
    name: 'Solarized Dark',
    foreground: '#93a1a1', background: '#002b36', cursor: '#839496', cursorAccent: '#002b36',
    selectionBackground: 'rgba(7, 54, 66, 0.8)', selectionForeground: '#93a1a1',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
    blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#586e75', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
    brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
  },
  nord: {
    name: 'Nord',
    foreground: '#88c0d0', background: '#2e3440', cursor: '#d8dee9', cursorAccent: '#2e3440',
    selectionBackground: 'rgba(136, 192, 208, 0.2)', selectionForeground: '#d8dee9',
    black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
    blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
    brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c', brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1', brightMagenta: '#b48ead', brightCyan: '#8fbcbb', brightWhite: '#eceff4',
  },
  github: {
    name: 'GitHub',
    foreground: '#85e89d', background: '#24292e', cursor: '#c9d1d9', cursorAccent: '#24292e',
    selectionBackground: 'rgba(56, 139, 253, 0.3)', selectionForeground: '#d1d5da',
    black: '#586069', red: '#ea4a5a', green: '#34d058', yellow: '#ffea7f',
    blue: '#2188ff', magenta: '#b392f0', cyan: '#39c5cf', white: '#e1e4e8',
    brightBlack: '#959da5', brightRed: '#f97583', brightGreen: '#85e89d', brightYellow: '#fff5b1',
    brightBlue: '#79b8ff', brightMagenta: '#b392f0', brightCyan: '#56d4dd', brightWhite: '#fafbfc',
  },
}

const STORAGE_KEY = 'shell-app-settings'

const defaultSearchColors: SearchColors = {
  matchBackground: 'rgba(76, 175, 80, 0.3)',
  matchBorder: 'rgba(76, 175, 80, 0.6)',
  activeMatchBackground: 'rgba(76, 175, 80, 0.5)',
  activeMatchBorder: 'rgba(76, 175, 80, 0.9)',
}

export type EditorMode = 'window' | 'tab'

function loadSettings(): { searchColors: SearchColors; theme: ThemeMode; terminalTheme: string; customTerminalThemes: TerminalTheme[]; editorMode: EditorMode; maxConcurrentDownloads: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        searchColors: { ...defaultSearchColors, ...parsed.searchColors },
        theme: parsed.theme || 'dark',
        terminalTheme: parsed.terminalTheme || 'default',
        customTerminalThemes: parsed.customTerminalThemes || [],
        editorMode: parsed.editorMode || 'window',
        maxConcurrentDownloads: parsed.maxConcurrentDownloads || 3,
      }
    }
  } catch {}
  return { searchColors: { ...defaultSearchColors }, theme: 'dark', terminalTheme: 'default', customTerminalThemes: [], editorMode: 'window', maxConcurrentDownloads: 3 }
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadSettings()
  const searchColors = ref<SearchColors>(saved.searchColors)
  const theme = ref<ThemeMode>(saved.theme)
  const terminalThemeName = ref<string>(saved.terminalTheme)
  const customTerminalThemes = ref<TerminalTheme[]>(saved.customTerminalThemes)
  const editorMode = ref<EditorMode>(saved.editorMode)
  const maxConcurrentDownloads = ref<number>(saved.maxConcurrentDownloads)

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      searchColors: searchColors.value,
      theme: theme.value,
      terminalTheme: terminalThemeName.value,
      customTerminalThemes: customTerminalThemes.value,
      editorMode: editorMode.value,
      maxConcurrentDownloads: maxConcurrentDownloads.value,
    }))
  }

  function getTerminalTheme(): TerminalTheme {
    // 先查预设
    if (TERMINAL_PRESETS[terminalThemeName.value]) {
      return TERMINAL_PRESETS[terminalThemeName.value]
    }
    // 再查自定义
    const custom = customTerminalThemes.value.find(t => t.name === terminalThemeName.value)
    if (custom) return custom
    return TERMINAL_PRESETS.default
  }

  function setTerminalTheme(name: string) {
    terminalThemeName.value = name
    saveSettings()
  }

  function addCustomTheme(t: TerminalTheme) {
    const idx = customTerminalThemes.value.findIndex(x => x.name === t.name)
    if (idx >= 0) {
      customTerminalThemes.value[idx] = { ...t }
    } else {
      customTerminalThemes.value.push({ ...t })
    }
    terminalThemeName.value = t.name
    saveSettings()
  }

  function deleteCustomTheme(name: string) {
    customTerminalThemes.value = customTerminalThemes.value.filter(t => t.name !== name)
    if (terminalThemeName.value === name) {
      terminalThemeName.value = 'default'
    }
    saveSettings()
  }

  watch(searchColors, saveSettings, { deep: true })
  watch(theme, saveSettings)
  watch(terminalThemeName, saveSettings)
  watch(editorMode, saveSettings)
  watch(maxConcurrentDownloads, saveSettings)

  function resetSearchColors() {
    searchColors.value = { ...defaultSearchColors }
  }

  function setTheme(mode: ThemeMode) {
    theme.value = mode
    applyTheme(mode)
  }

  function applyTheme(mode: ThemeMode) {
    const isDark = mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // 初始化主题
  applyTheme(theme.value)

  // 监听系统主题变化
  if (theme.value === 'system') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (theme.value === 'system') {
        applyTheme('system')
      }
    })
  }

  return {
    searchColors,
    theme,
    terminalThemeName,
    customTerminalThemes,
    editorMode,
    maxConcurrentDownloads,
    resetSearchColors,
    setTheme,
    applyTheme,
    defaultSearchColors,
    getTerminalTheme,
    setTerminalTheme,
    addCustomTheme,
    deleteCustomTheme,
  }
})
