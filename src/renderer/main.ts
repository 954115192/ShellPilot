import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import './styles/dark-mode.css';
import './api/electron';

const params = new URLSearchParams(window.location.search);
const isEditorWindow = params.has('editor');

async function bootstrap() {
  const rootComponent = isEditorWindow
    ? (await import('./components/files/EditorWindow.vue')).default
    : (await import('./App.vue')).default;

  const app = createApp(rootComponent);
  const pinia = createPinia();

  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component);
  }

  app.use(pinia);
  app.use(ElementPlus);
  app.mount('#app');

  // 主窗口：全局 AI 事件监听
  if (!isEditorWindow) {
    const { useAIStore } = await import('./stores/aiStore');
    const aiStore = useAIStore(pinia);
    if (window.electronAPI && window.electronAPI.onAIEvent) {
      window.electronAPI.onAIEvent((data: { tabId: string; event: any }) => {
        aiStore.addAgentEvent(data.tabId, data.event);
      });
    }
  }
}

bootstrap();