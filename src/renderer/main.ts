import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css'; // 引入暗黑模式样式
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import App from './App.vue';
import './styles/dark-mode.css'; // 引入自定义暗黑模式样式

import './api/electron';

const app = createApp(App);
const pinia = createPinia();

// 注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(pinia);
app.use(ElementPlus);
app.mount('#app');

// 全局注册 AI 事件监听（只注册一次）
import { useAIStore } from './stores/aiStore';
const aiStore = useAIStore(pinia);
if (window.electronAPI && window.electronAPI.onAIEvent) {
  window.electronAPI.onAIEvent((data: { tabId: string; event: any }) => {
    aiStore.addAgentEvent(data.tabId, data.event);
  });
}