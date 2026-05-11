import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TerminalTab {
  id: string;
  name: string;
  session: any;
}

export const useTerminalStore = defineStore('terminal', () => {
  const tabs = ref<TerminalTab[]>([]);
  const activeTabId = ref('');
  const commandHistories = ref<Map<string, string[]>>(new Map());
  const historyIndices = ref<Map<string, number>>(new Map());

  const activeSession = computed(() => {
    const tab = tabs.value.find(t => t.id === activeTabId.value);
    return tab?.session || null;
  });

  function setActiveTabIdAction(tabId: string): void {
    activeTabId.value = tabId;
  }

  function addTab(tab: TerminalTab): void {
    tabs.value.push(tab);
    activeTabId.value = tab.id;
    if (!commandHistories.value.has(tab.id)) {
      commandHistories.value.set(tab.id, []);
      historyIndices.value.set(tab.id, 0);
    }
  }

  function removeTab(tabId: string): void {
    const index = tabs.value.findIndex(t => t.id === tabId);
    if (index >= 0) {
      tabs.value.splice(index, 1);
      commandHistories.value.delete(tabId);
      historyIndices.value.delete(tabId);
      if (activeTabId.value === tabId) {
        activeTabId.value = tabs.value.length > 0
          ? tabs.value[Math.max(0, index - 1)].id
          : '';
      }
    }
  }

  function addToHistory(tabId: string, command: string): void {
    if (!commandHistories.value.has(tabId)) {
      commandHistories.value.set(tabId, []);
    }
    const history = commandHistories.value.get(tabId)!;
    history.push(command);
    if (history.length > 500) {
      history.shift();
    }
    historyIndices.value.set(tabId, history.length);
  }

  function getPreviousCommand(tabId: string): string {
    const history = commandHistories.value.get(tabId);
    if (!history || history.length === 0) return '';
    let idx = historyIndices.value.get(tabId) ?? history.length;
    if (idx > 0) {
      idx--;
      historyIndices.value.set(tabId, idx);
      return history[idx];
    }
    return history.length > 0 ? history[0] : '';
  }

  function getNextCommand(tabId: string): string {
    const history = commandHistories.value.get(tabId);
    if (!history || history.length === 0) return '';
    let idx = historyIndices.value.get(tabId) ?? history.length;
    if (idx < history.length - 1) {
      idx++;
      historyIndices.value.set(tabId, idx);
      return history[idx];
    }
    historyIndices.value.set(tabId, history.length);
    return '';
  }

  function updateTabSession(tabId: string, session: any): void {
    const tab = tabs.value.find(t => t.id === tabId);
    if (tab) {
      tab.session = session;
    }
  }

  function getAllTabs(): TerminalTab[] {
    return tabs.value;
  }

  return {
    tabs,
    activeTabId,
    activeSession,
    setActiveTabId: setActiveTabIdAction,
    addTab,
    removeTab,
    addToHistory,
    getPreviousCommand,
    getNextCommand,
    updateTabSession,
    getAllTabs,
  };
});

// Module-level convenience exports (keep API compatible with existing importers)
export function getActiveTabId(): string {
  return useTerminalStore().activeTabId;
}

export function setActiveTabId(tabId: string): void {
  useTerminalStore().setActiveTabId(tabId);
}

export function getActiveSession(): any {
  return useTerminalStore().activeSession;
}

export function addTab(tab: TerminalTab): void {
  useTerminalStore().addTab(tab);
}

export function removeTab(tabId: string): void {
  useTerminalStore().removeTab(tabId);
}

export function addToHistory(tabId: string, command: string): void {
  useTerminalStore().addToHistory(tabId, command);
}

export function getPreviousCommand(tabId: string): string {
  return useTerminalStore().getPreviousCommand(tabId);
}

export function getNextCommand(tabId: string): string {
  return useTerminalStore().getNextCommand(tabId);
}

export function updateTabSession(tabId: string, session: any): void {
  useTerminalStore().updateTabSession(tabId, session);
}

export function getAllTabs(): TerminalTab[] {
  return useTerminalStore().getAllTabs();
}
