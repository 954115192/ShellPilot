<template>
  <div class="file-browser">
    <el-card class="file-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">文件管理</span>

          <div class="path-bar">
            <el-input
                v-model="currentPath"
                placeholder="/"
                size="small"
                @keyup.enter="navigateToPath"
                class="path-input"
            >
              <template #prefix>
                <el-icon class="path-root-btn" @click="goToRoot" title="回到根目录">
                  <Folder/>
                </el-icon>
              </template>
              <template #suffix>
                <el-button
                    link
                    size="small"
                    @click="copyPath"
                    title="复制路径"
                    class="copy-btn"
                >
                  <el-icon>
                    <DocumentCopy/>
                  </el-icon>
                </el-button>
              </template>
            </el-input>
            <el-button size="small" @click="goUp" title="上一层">
              <el-icon>
                <ArrowUp/>
              </el-icon>
            </el-button>
            <el-button type="primary" size="small" @click="refreshTree">
              <el-icon>
                <Refresh/>
              </el-icon>
              刷新
            </el-button>
            <el-button size="small" @click="uploadToCurrent" title="上传文件到当前目录">
              <el-icon>
                <Upload/>
              </el-icon>
              上传
            </el-button>
          </div>
          <el-button class="close-btn" circle size="small" type="danger" plain @click="$emit('close')" title="关闭">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </template>

      <div class="browser-container">
        <div class="tree-panel" @contextmenu.prevent.stop>
          <div class="tree-container" v-loading="loading">
            <div v-if="!isConnected" class="not-connected">
              <el-empty description="请先在终端连接到服务器" :image-size="60">
                <template #image>
                  <el-icon :size="40" color="var(--el-color-info)">
                    <Monitor/>
                  </el-icon>
                </template>
              </el-empty>
              <el-button type="primary" @click="goToTerminal">前往终端</el-button>
            </div>

            <el-tree
                v-else
                ref="treeRef"
                :props="treeProps"
                :load="loadNode"
                lazy
                node-key="path"
                :expand-on-click-node="true"
                @node-click="handleTreeClick"
                class="directory-tree"
            >
              <template #default="{ node, data }">
                <span class="tree-node-label">
                  <el-icon v-if="data.isSymlink && data.isDirectory" :size="14" color="#67c23a">
                    <FolderOpened/>
                  </el-icon>
                  <el-icon v-else-if="data.isSymlink" :size="14" color="#67c23a">
                    <component :is="getFileIcon(data.label || data.filename || '')"/>
                  </el-icon>
                  <el-icon v-else-if="data.isDirectory" :size="14" color="#f5a623">
                    <Folder/>
                  </el-icon>
                  <el-icon v-else :size="14" color="#409EFF">
                    <component :is="getFileIcon(data.label || data.filename || '')"/>
                  </el-icon>
                  {{ node.label }}
                </span>
              </template>
            </el-tree>
          </div>
        </div>

        <div
            class="list-panel"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
            @contextmenu.prevent="handleListPanelContextMenu"
        >
          <!-- 拖入上传覆盖层 -->
          <div v-if="isDragOver" class="drop-overlay">
            <div class="drop-content">
              <el-icon :size="48" color="var(--el-color-primary)">
                <Upload/>
              </el-icon>
              <span class="drop-text">拖入文件上传到 {{ currentPath }}</span>
            </div>
          </div>
          <el-table
              :data="sortedFileList"
              style="width: 100%"
              height="100%"
              border
              @row-dblclick="handleRowDblClick"
              @sort-change="handleSortChange"
              @row-contextmenu="handleContextMenu"
              v-loading="listLoading"
          >
            <el-table-column prop="label" label="名称" min-width="200" sortable="custom">
              <template #default="{ row }">
                <div class="file-name-cell">
                  <el-icon v-if="row.isSymlink && row.isDirectory" :size="16" color="#67C23A">
                    <FolderOpened/>
                  </el-icon>
                  <el-icon v-else-if="row.isSymlink" :size="16" color="#67C23A">
                    <component :is="getFileIcon(row.label)"/>
                  </el-icon>
                  <el-icon v-else-if="row.isDirectory" :size="16" color="#f5a623">
                    <Folder/>
                  </el-icon>
                  <el-icon v-else :size="16" color="#409EFF">
                    <component :is="getFileIcon(row.label)"/>
                  </el-icon>
                  <span class="file-name">{{ row.label }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="typeLabel" label="类型" width="100" sortable="custom">
              <template #default="{ row }">
                <el-tag size="small" :type="row.isDirectory ? 'warning' : 'info'">
                  {{ row.typeLabel }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column prop="mode" label="权限" width="120" sortable="custom"/>

            <el-table-column prop="owner" label="所有者" width="100" sortable="custom"/>

            <el-table-column prop="group" label="所属组" width="100" sortable="custom"/>

            <el-table-column prop="size" label="大小" width="100" sortable="custom">
              <template #default="{ row }">
                <span v-if="!row.isDirectory">{{ formatSize(row.size) }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>

            <el-table-column prop="mtimeNum" label="修改时间" width="160" sortable="custom">
              <template #default="{ row }">
                {{ formatTime(row.mtimeNum) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-card>
    <el-dropdown
        ref="contextMenuDropdownRef"
        :virtual-ref="triggerRef"
        trigger="click"
        virtual-triggering
        :show-arrow="false"
        @command="handleContextMenuCommand"
        @visible-change="onMenuVisibleChange"
    >
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="newFolder">
            <el-icon><FolderAdd/></el-icon> 新建文件夹
          </el-dropdown-item>
          <el-dropdown-item command="newFile">
            <el-icon><DocumentAdd/></el-icon> 新建文件
          </el-dropdown-item>

          <el-dropdown-item
              command="uploadToDir"
              :disabled="!contextMenuItem || !contextMenuItem.isDirectory"
              divided
          >
            <el-icon><Upload/></el-icon> 上传到此处
          </el-dropdown-item>
          <el-dropdown-item
              command="download"
              :disabled="!contextMenuItem"
          >
            <el-icon><Download/></el-icon> 下载
          </el-dropdown-item>
          <el-dropdown-item command="open" :disabled="!contextMenuItem">
            <el-icon><FolderOpened/></el-icon> 本地编辑器打开
          </el-dropdown-item>
          <el-dropdown-item
              command="editInline"
              :disabled="!contextMenuItem || !!contextMenuItem.isDirectory || isBinaryFile(contextMenuItem?.label || '')"
          >
            <el-icon><EditPen/></el-icon> 内置编辑器打开
          </el-dropdown-item>

          <el-dropdown-item command="rename" :disabled="!contextMenuItem" divided>
            <el-icon><Edit/></el-icon> 重命名
          </el-dropdown-item>
          <el-dropdown-item command="changePermissions" :disabled="!contextMenuItem">
            <el-icon><Lock/></el-icon> 权限修改
          </el-dropdown-item>

          <el-dropdown-item
              command="copy"
              :disabled="!contextMenuItem"
              divided
          >
            <el-icon><CopyDocument/></el-icon> 复制
          </el-dropdown-item>
          <el-dropdown-item
              command="paste"
              :disabled="!clipboard"
          >
            <el-icon><DocumentCopy/></el-icon> 粘贴
          </el-dropdown-item>

          <el-dropdown-item
              command="compress"
              :disabled="!contextMenuItem || !contextMenuItem.isDirectory"
              divided
          >
            <el-icon><Box/></el-icon> 压缩 (tar.gz)
          </el-dropdown-item>
          <el-dropdown-item
              command="decompress"
              :disabled="!contextMenuItem || !isArchiveFile(contextMenuItem?.label || '')"
          >
            <el-icon><Files/></el-icon> 解压
          </el-dropdown-item>

          <el-dropdown-item command="delete" :disabled="!contextMenuItem" divided>
            <el-icon><Delete/></el-icon> 删除
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 新建文件夹对话框 -->
    <el-dialog v-model="showNewFolderDialog" title="新建文件夹" width="400">
      <el-input v-model="newFolderName" placeholder="输入文件夹名称"/>
      <template #footer>
        <el-button @click="showNewFolderDialog = false">取消</el-button>
        <el-button type="primary" @click="doNewFolder">确定</el-button>
      </template>
    </el-dialog>

    <!-- 新建文件对话框 -->
    <el-dialog v-model="showNewFileDialog" title="新建文件" width="400">
      <el-input v-model="newFileName" placeholder="输入文件名"/>
      <template #footer>
        <el-button @click="showNewFileDialog = false">取消</el-button>
        <el-button type="primary" @click="doNewFile">确定</el-button>
      </template>
    </el-dialog>

    <!-- 权限修改对话框 -->
    <el-dialog v-model="showPermissionDialog" title="权限修改" width="450">
      <template v-if="permissionItem">
        <div class="perm-section">
          <div class="perm-row">
            <span class="perm-label">所有者</span>
            <label><input type="checkbox" v-model="permOwner.r"/> 读</label>
            <label><input type="checkbox" v-model="permOwner.w"/> 写</label>
            <label><input type="checkbox" v-model="permOwner.x"/> 执行</label>
          </div>
          <div class="perm-row">
            <span class="perm-label">用户组</span>
            <label><input type="checkbox" v-model="permGroup.r"/> 读</label>
            <label><input type="checkbox" v-model="permGroup.w"/> 写</label>
            <label><input type="checkbox" v-model="permGroup.x"/> 执行</label>
          </div>
          <div class="perm-row">
            <span class="perm-label">其他</span>
            <label><input type="checkbox" v-model="permOther.r"/> 读</label>
            <label><input type="checkbox" v-model="permOther.w"/> 写</label>
            <label><input type="checkbox" v-model="permOther.x"/> 执行</label>
          </div>
        </div>
        <div class="perm-numeric">chmod {{ permNumeric }} "{{ permissionItem.label }}"</div>
      </template>
      <template #footer>
        <el-button @click="showPermissionDialog = false">取消</el-button>
        <el-button type="primary" @click="doChangePermissions">确定</el-button>
      </template>
    </el-dialog>

    <!-- 重命名对话框 -->
    <el-dialog v-model="showRenameDialogFlag" title="重命名" width="400">
      <el-input v-model="renameInput" placeholder="输入新名称"/>
      <template #footer>
        <el-button @click="showRenameDialogFlag = false">取消</el-button>
        <el-button type="primary" @click="renameItem">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted, onBeforeUnmount, watch} from 'vue';
import type {ElTree} from 'element-plus';
import {
  Folder,
  Document,
  Refresh,
  Monitor,
  FolderOpened,
  DocumentCopy,
  EditPen,
  ArrowUp,
  Download,
  Upload,
  Delete,
  Edit,
  FolderAdd,
  DocumentAdd,
  Lock,
  CopyDocument,
  Setting,
  Picture,
  VideoPlay,
  Headset,
  Coin,
  Box,
  Memo,
  Notebook,
  Printer,
  Key,
  Files
} from '@element-plus/icons-vue';
import {ElMessage, ElMessageBox} from 'element-plus';
import {getActiveTabId, getActiveSession} from '../../stores/terminalStore';
import {useTransferStore} from '../../stores/transferStore';
import {useSettingsStore} from '../../stores/settingsStore';

const props = defineProps<{
  tabId?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const transferStore = useTransferStore()

interface FileItem {
  label: string;
  path: string;
  isDirectory: boolean;
  isSymlink?: boolean;
  size: number;
  mode?: string;
  mtimeNum?: number;
  owner?: string;
  group?: string;
  typeLabel: string;
}

const treeRef = ref<InstanceType<typeof ElTree>>();
const loading = ref(false);
const listLoading = ref(false);
const isConnected = ref(false);
const currentPath = ref('/');
const fileList = ref<FileItem[]>([]);

const historyStack = ref<string[]>(['/']);
const historyIndex = ref(0);

const sortConfig = ref({
  prop: 'label',
  order: 'ascending' as 'ascending' | 'descending' | null
});

const treeProps = {
  label: 'label',
  children: 'children',
};

const contextMenuItem = ref<FileItem | null>(null);
const contextMenuDropdownRef = ref();
const contextMenuVisible = ref(false);
const clipboard = ref<{ item: FileItem; action: 'copy' } | null>(null);
const position = ref({
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
})
const triggerRef = ref({
  getBoundingClientRect: () => position.value,
})
// 拖入上传
const isDragOver = ref(false);

// 新建文件/文件夹
const showNewFolderDialog = ref(false);
const newFolderName = ref('');
const showNewFileDialog = ref(false);
const newFileName = ref('');

// 权限修改
const showPermissionDialog = ref(false);
const permissionItem = ref<FileItem | null>(null);
const permOwner = ref({r: true, w: true, x: false});
const permGroup = ref({r: true, w: false, x: false});
const permOther = ref({r: true, w: false, x: false});

const showRenameDialogFlag = ref(false);
const renameInput = ref('');

const sortedFileList = computed(() => {
  const list = [...fileList.value];
  const {prop, order} = sortConfig.value;

  if (!prop || !order) return list;

  list.sort((a: any, b: any) => {
    let aVal = a[prop];
    let bVal = b[prop];

    if (aVal === undefined || aVal === null) aVal = '';
    if (bVal === undefined || bVal === null) bVal = '';

    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return order === 'ascending'
          ? aVal.localeCompare(bVal, 'zh-CN')
          : bVal.localeCompare(aVal, 'zh-CN');
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return order === 'ascending' ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });

  return list;
});

// 权限数字表示
const permNumeric = computed(() => {
  const o = (permOwner.value.r ? 4 : 0) + (permOwner.value.w ? 2 : 0) + (permOwner.value.x ? 1 : 0);
  const g = (permGroup.value.r ? 4 : 0) + (permGroup.value.w ? 2 : 0) + (permGroup.value.x ? 1 : 0);
  const u = (permOther.value.r ? 4 : 0) + (permOther.value.w ? 2 : 0) + (permOther.value.x ? 1 : 0);
  return `${o}${g}${u}`;
});

const getTabId = (): string => {
  if (props.tabId) return props.tabId
  const activeTabId = getActiveTabId();
  if (activeTabId) return activeTabId;

  const activeSession = getActiveSession();
  return activeSession?.tabId || '';
};

const formatSize = (size: number): string => {
  if (!size || size === 0) return '-';
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + ' MB';
  return (size / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
};

const formatMode = (mode?: number): string => {
  if (!mode) return '-';

  const types = ['-', 'd', 'l', 'c', 'b', 'p', 's'];
  const type = types[(mode >> 12) & 7] || '-';

  const perms = [
    (mode & 0o400) ? 'r' : '-',
    (mode & 0o200) ? 'w' : '-',
    (mode & 0o100) ? 'x' : '-',
    (mode & 0o040) ? 'r' : '-',
    (mode & 0o020) ? 'w' : '-',
    (mode & 0o010) ? 'x' : '-',
    (mode & 0o004) ? 'r' : '-',
    (mode & 0o002) ? 'w' : '-',
    (mode & 0o001) ? 'x' : '-',
  ];

  return type + perms.join('');
};

const formatTime = (timestamp?: number): string => {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const copyPath = async () => {
  try {
    await navigator.clipboard.writeText(currentPath.value);
    ElMessage.success('路径已复制');
  } catch {
    ElMessage.error('复制失败');
  }
};

const addToHistory = (path: string) => {
  if (historyIndex.value < historyStack.value.length - 1) {
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
  }

  if (historyStack.value[historyStack.value.length - 1] !== path) {
    historyStack.value.push(path);
    historyIndex.value = historyStack.value.length - 1;
  }
};

const goBack = () => {
  if (historyIndex.value > 0) {
    historyIndex.value--;
    const path = historyStack.value[historyIndex.value];
    currentPath.value = path;
    loadDirectoryContent(path);
  }
};

const goForward = () => {
  if (historyIndex.value < historyStack.value.length - 1) {
    historyIndex.value++;
    const path = historyStack.value[historyIndex.value];
    currentPath.value = path;
    loadDirectoryContent(path);
  }
};

const goToRoot = () => {
  currentPath.value = '/';
  addToHistory('/');
  loadDirectoryContent('/');
};

const goUp = () => {
  if (currentPath.value === '/') return;

  const parts = currentPath.value.split('/').filter(Boolean);
  parts.pop();
  const parentPath = parts.length > 0 ? '/' + parts.join('/') : '/';

  currentPath.value = parentPath;
  loadDirectoryContent(parentPath);
};

const navigateToPath = () => {
  if (currentPath.value) {
    addToHistory(currentPath.value);
    loadDirectoryContent(currentPath.value);
  }
};

const SKIP_DIRS: string[] = [];

const extractOwner = (longname: string): string | undefined => {
  const parts = longname.split(/\s+/);
  return parts.length > 2 ? parts[2] : undefined;
};

const extractGroup = (longname: string): string | undefined => {
  const parts = longname.split(/\s+/);
  return parts.length > 3 ? parts[3] : undefined;
};

const shouldSkip = (filename: string, parentPath: string): boolean => {
  const fullPath = parentPath === '/' ? '/' + filename : parentPath + '/' + filename;
  return SKIP_DIRS.some(skipPath => fullPath === skipPath || fullPath.startsWith(skipPath + '/'));
};

const normalizePath = (path: string): string => {
  if (!path || path === '/') return '/';
  const parts = path.split('/').filter(Boolean);
  const normalized: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      normalized.pop();
    } else {
      normalized.push(part);
    }
  }
  return '/' + normalized.join('/');
};

const loadNode = async (node: any, resolve: any) => {
  const tabId = getTabId();
  if (!tabId) {
    isConnected.value = false;
    return resolve([]);
  }

  if (node.level === 0) {
    const rootNodes = await loadDirectoryLevel('/');
    return resolve(rootNodes);
  }

  const nodeData = node.data as any;

  if (!nodeData.isDirectory) {
    return resolve([]);
  }

  const childNodes = await loadDirectoryLevel(nodeData.path);
  return resolve(childNodes);
};

const loadDirectoryLevel = async (path: string): Promise<any[]> => {
  const tabId = getTabId();
  if (!tabId) return [];

  try {
    const normalizedPath = normalizePath(path);
    const result = await window.electronAPI.listDirectory(normalizedPath, tabId);

    if (!result.success) {
      return [];
    }

    if (result.files) {
      const nodes: any[] = [];
      const filesToLoad = result.files.slice(0, 100);

      for (const file of filesToLoad) {
        if (shouldSkip(file.filename, path)) {
          continue;
        }

        const isSymlink = file.attrs?.isSymbolicLink || false;
        const isDirectory = file.attrs?.isDirectory || false;

        const nodePath = normalizePath(path === '/' ? '/' + file.filename : path + '/' + file.filename);

        const node = {
          label: file.filename,
          path: nodePath,
          isDirectory: isDirectory,
          isSymlink: isSymlink,
        };

        nodes.push(node);
      }

      nodes.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.label.localeCompare(b.label, 'zh-CN');
      });

      isConnected.value = true;
      return nodes;
    }
  } catch (error) {
    console.error('[FileBrowser] Failed to load directory:', error);
  }

  return [];
};

const loadDirectoryContent = async (path: string) => {
  const tabId = getTabId();
  if (!tabId) {
    ElMessage.warning('请先连接到服务器');
    return;
  }

  listLoading.value = true;
  try {
    const normalizedPath = normalizePath(path);
    const result = await window.electronAPI.listDirectory(normalizedPath, tabId);

    if (!result.success) {
      ElMessage.error('加载目录失败：' + (result.error || '未知错误'));
      isConnected.value = false;
      return;
    }

    isConnected.value = true;
    currentPath.value = normalizedPath;
    fileList.value = [];

    if (historyStack.value[historyIndex.value] !== normalizedPath) {
      addToHistory(normalizedPath);
    }

    if (result.files) {
      const items: FileItem[] = [];

      for (const file of result.files) {
        if (shouldSkip(file.filename, normalizedPath)) {
          continue;
        }

        const isSymlink = file.attrs?.isSymbolicLink || false;
        const isDirectory = file.attrs?.isDirectory || false;

        const filePath = normalizePath(normalizedPath === '/' ? '/' + file.filename : normalizedPath + '/' + file.filename);

        let typeLabel = '文件';
        if (isSymlink && isDirectory) typeLabel = '链接文件夹';
        else if (isSymlink) typeLabel = '链接文件';
        else if (isDirectory) typeLabel = '文件夹';

        items.push({
          label: file.filename,
          path: filePath,
          isDirectory: isDirectory,
          isSymlink: isSymlink,
          size: file.attrs?.size || 0,
          mode: formatMode(file.attrs?.mode),
          mtimeNum: file.attrs?.mtime,
          owner: file.longname ? extractOwner(file.longname) : undefined,
          group: file.longname ? extractGroup(file.longname) : undefined,
          typeLabel,
        });
      }

      fileList.value = items;
    }
  } catch (error) {
    ElMessage.error('加载失败：' + (error as Error).message);
  } finally {
    listLoading.value = false;
  }
};

const handleTreeClick = (data: any) => {
  if (data.isDirectory) {
    currentPath.value = data.path;
    addToHistory(data.path);
    loadDirectoryContent(data.path);
  }
};

const settingsStore = useSettingsStore();

const BINARY_EXTENSIONS = new Set([
  'exe','dll','so','dylib','bin','dat','db','sqlite','mdb',
  'zip','tar','gz','bz2','xz','7z','rar','tgz',
  'png','jpg','jpeg','gif','bmp','ico','webp','svgz','tiff','tif',
  'mp3','mp4','avi','mkv','mov','wav','flac','ogg','webm',
  'pdf','doc','docx','xls','xlsx','ppt','pptx',
  'class','jar','war','pyc','pyo','o','a','lib',
]);
const isBinaryFile = (name: string): boolean => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return BINARY_EXTENSIONS.has(ext);
};

const isArchiveFile = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.endsWith('.tar.gz') || lower.endsWith('.tgz') || lower.endsWith('.tar.bz2') ||
    lower.endsWith('.tar.xz') || lower.endsWith('.tar') || lower.endsWith('.gz') ||
    lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z');
};

const FILE_ICON_MAP: Record<string, any> = {
  // 代码
  js: Monitor, mjs: Monitor, cjs: Monitor, ts: Monitor, mts: Monitor,
  jsx: Monitor, tsx: Monitor, vue: Monitor, svelte: Monitor,
  py: Monitor, go: Monitor, rs: Monitor, java: Monitor,
  c: Monitor, cpp: Monitor, h: Monitor, hpp: Monitor,
  rb: Monitor, php: Monitor, swift: Monitor, kt: Monitor, scala: Monitor,
  sh: Monitor, bash: Monitor, zsh: Monitor, fish: Monitor, ps1: Monitor,
  // 配置
  json: Setting, jsonc: Setting, yaml: Setting, yml: Setting,
  toml: Setting, ini: Setting, cfg: Setting, conf: Setting, env: Setting,
  // Web
  html: Monitor, htm: Monitor, css: Monitor, scss: Monitor, less: Monitor,
  // 图片
  png: Picture, jpg: Picture, jpeg: Picture, gif: Picture, bmp: Picture,
  webp: Picture, ico: Picture, svg: Picture, psd: Picture, tiff: Picture,
  // 视频
  mp4: VideoPlay, avi: VideoPlay, mkv: VideoPlay, mov: VideoPlay,
  wmv: VideoPlay, flv: VideoPlay, webm: VideoPlay,
  // 音频
  mp3: Headset, wav: Headset, flac: Headset, aac: Headset, ogg: Headset, wma: Headset,
  // 文档
  txt: Document, log: Document, md: Document, markdown: Document, rst: Document,
  // 数据库 / 数据
  sql: Coin, db: Coin, sqlite: Coin, sqlite3: Coin,
  // 压缩包
  zip: Box, tar: Box, gz: Box, bz2: Box, '7z': Box, rar: Box, xz: Box,
  // Office
  doc: Memo, docx: Memo, rtf: Memo,
  xls: Notebook, xlsx: Notebook, csv: Notebook, tsv: Notebook,
  ppt: Printer, pptx: Printer,
  pdf: Printer,
  // 密钥
  pem: Key, key: Key, pub: Key, crt: Lock, cert: Lock,
  // 字体
  ttf: Files, otf: Files, woff: Files, woff2: Files, eot: Files,
};

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return FILE_ICON_MAP[ext] || Document;
};

const openInEditor = async (file: FileItem) => {
  const tabId = getTabId();
  const isDark = document.documentElement.classList.contains('dark');
  await window.electronAPI.openEditorWindow(file.path, file.label, tabId, isDark, settingsStore.editorMode);
};

const confirmOpenLargeFile = async (file: FileItem): Promise<boolean> => {
  if (file.size > 5 * 1024 * 1024) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    try {
      await ElMessageBox.confirm(
        `文件 "${file.label}" 大小为 ${sizeMB} MB，过大的文件可能导致编辑器卡顿或卡死，确定要打开吗？`,
        '文件过大',
        { confirmButtonText: '仍然打开', cancelButtonText: '取消', type: 'warning' }
      );
      return true;
    } catch { return false; }
  }
  return true;
};

const handleRowDblClick = async (row: FileItem) => {
  if (row.isDirectory) {
    currentPath.value = row.path;
    addToHistory(row.path);

    await expandTreePath(row.path);

    loadDirectoryContent(row.path);

    if (treeRef.value) {
      treeRef.value.setCurrentKey(row.path);
    }
  } else if (isBinaryFile(row.label)) {
    openFileWithLocalProgram(row);
  } else if (await confirmOpenLargeFile(row)) {
    openInEditor(row);
  }
};

const expandTreePath = async (path: string): Promise<void> => {
  if (!treeRef.value || path === '/') return;
  const parts = path.split('/').filter(Boolean);
  let currentPath = '';
  for (let i = 0; i < parts.length; i++) {
    currentPath = '/' + parts.slice(0, i + 1).join('/');
    const node = treeRef.value.getNode(currentPath);
    if (node && !node.expanded) {
      node.expand();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
};

const handleSortChange = ({prop, order}: { prop: string; order: string | null }) => {
  sortConfig.value = {
    prop,
    order: order as 'ascending' | 'descending' | null
  };
};

// 通用：打开右键菜单（先关闭已有菜单，重新定位再打开）
const openContextMenu = (event: MouseEvent) => {
  const { clientX, clientY } = event
  position.value = DOMRect.fromRect({
    x: clientX,
    y: clientY,
  })
  contextMenuDropdownRef.value.handleOpen();
};

// 右键菜单 - 行级（完整菜单）
const handleContextMenu = (row: FileItem, _column: any, event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  contextMenuItem.value = row;
  if (contextMenuVisible.value) {
    contextMenuDropdownRef.value.handleClose();
  }
  setTimeout(() => {
    openContextMenu(event);
  }, 50);
};

// 右键菜单 - 空白区域（新建文件/文件夹）
const handleListPanelContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  contextMenuItem.value = null;
  if (contextMenuVisible.value) {
    contextMenuDropdownRef.value.handleClose();
  }
  setTimeout(() => {
    openContextMenu(event);
  }, 50);
};

// 监听下拉菜单显示状态
const onMenuVisibleChange = (visible: boolean) => {
  contextMenuVisible.value = visible;
};

// el-dropdown 命令处理
// 复制/粘贴
const copyItem = (item: FileItem | null) => {
  if (!item) return;
  clipboard.value = { item, action: 'copy' };
  ElMessage.success(`已复制 "${item.label}"`);
};

const pasteItem = async () => {
  if (!clipboard.value) return;
  const tabId = getTabId();
  if (!tabId) return;
  const src = clipboard.value.item;
  const destDir = currentPath.value;
  const destPath = destDir === '/' ? '/' + src.label : destDir + '/' + src.label;
  const cmd = src.isDirectory ? `cp -a "${src.path}" "${destPath}"` : `cp "${src.path}" "${destPath}"`;
  try {
    const result = await window.electronAPI.executeCommand(cmd, tabId);
    if (result.success) {
      ElMessage.success('粘贴成功');
      loadDirectoryContent(currentPath.value);
      clipboard.value = null;
    } else {
      ElMessage.error('粘贴失败：' + (result.error || result.output || ''));
    }
  } catch (e) {
    ElMessage.error('粘贴失败：' + (e as Error).message);
  }
};

// 压缩
const compressItem = async (item: FileItem | null) => {
  if (!item || !item.isDirectory) return;
  const tabId = getTabId();
  if (!tabId) return;
  const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '/';
  const archiveName = item.label + '.tar.gz';
  const archivePath = parentPath === '/' ? '/' + archiveName : parentPath + '/' + archiveName;
  try {
    ElMessage.info('正在压缩...');
    const result = await window.electronAPI.executeCommand(
      `tar -czf "${archivePath}" -C "${parentPath}" "${item.label}"`, tabId
    );
    if (result.success) {
      ElMessage.success('压缩完成：' + archiveName);
      loadDirectoryContent(currentPath.value);
    } else {
      ElMessage.error('压缩失败：' + (result.error || result.output || ''));
    }
  } catch (e) {
    ElMessage.error('压缩失败：' + (e as Error).message);
  }
};

// 解压
const decompressItem = async (item: FileItem | null) => {
  if (!item) return;
  const tabId = getTabId();
  if (!tabId) return;
  const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '/';
  const lower = item.label.toLowerCase();
  let cmd = '';
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    cmd = `tar -xzf "${item.path}" -C "${parentPath}"`;
  } else if (lower.endsWith('.tar.bz2')) {
    cmd = `tar -xjf "${item.path}" -C "${parentPath}"`;
  } else if (lower.endsWith('.tar.xz')) {
    cmd = `tar -xJf "${item.path}" -C "${parentPath}"`;
  } else if (lower.endsWith('.tar')) {
    cmd = `tar -xf "${item.path}" -C "${parentPath}"`;
  } else if (lower.endsWith('.gz')) {
    cmd = `gunzip -k "${item.path}"`;
  } else if (lower.endsWith('.zip')) {
    cmd = `unzip -o "${item.path}" -d "${parentPath}"`;
  } else {
    ElMessage.warning('暂不支持该压缩格式');
    return;
  }
  try {
    ElMessage.info('正在解压...');
    const result = await window.electronAPI.executeCommand(cmd, tabId);
    if (result.success) {
      ElMessage.success('解压完成');
      loadDirectoryContent(currentPath.value);
    } else {
      ElMessage.error('解压失败：' + (result.error || result.output || ''));
    }
  } catch (e) {
    ElMessage.error('解压失败：' + (e as Error).message);
  }
};

const handleContextMenuCommand = async (command: string) => {
  switch (command) {
    case 'newFolder':
      newFolder();
      break;
    case 'newFile':
      newFile();
      break;
    case 'download':
      downloadFile(contextMenuItem.value);
      break;
    case 'uploadToDir':
      uploadToDir(contextMenuItem.value);
      break;
    case 'open':
      openItem(contextMenuItem.value);
      break;
    case 'editInline':
      if (contextMenuItem.value) {
        if (await confirmOpenLargeFile(contextMenuItem.value)) {
          openInEditor(contextMenuItem.value);
        }
      }
      break;
    case 'rename':
      showRenameDialog(contextMenuItem.value);
      break;
    case 'changePermissions':
      changePermissions(contextMenuItem.value);
      break;
    case 'copy':
      copyItem(contextMenuItem.value);
      break;
    case 'paste':
      await pasteItem();
      break;
    case 'compress':
      await compressItem(contextMenuItem.value);
      break;
    case 'decompress':
      await decompressItem(contextMenuItem.value);
      break;
    case 'delete':
      deleteItem(contextMenuItem.value);
      break;
  }
};

// ---- 下载队列 ----
interface DownloadQueueItem {
  id: string; tabId: string; type: 'file' | 'directory'
  remotePath?: string; localPath?: string
  dirLocalPath?: string; dirBaseTransferId?: string
}
const downloadQueue = ref<DownloadQueueItem[]>([])
const activeDownloads = ref(0)

const processDownloadQueue = () => {
  while (activeDownloads.value < settingsStore.maxConcurrentDownloads && downloadQueue.value.length > 0) {
    const item = downloadQueue.value.shift()!
    activeDownloads.value++
    transferStore.startTransfer(item.id)

    if (item.type === 'file') {
      window.electronAPI.downloadFile(item.remotePath!, item.localPath!, item.tabId, item.id).then((result: any) => {
        if (result.success) {
          transferStore.completeTransfer(item.id)
        } else {
          transferStore.failTransfer(item.id, result.error || '下载失败')
        }
      }).catch((err: Error) => {
        transferStore.failTransfer(item.id, err.message)
      }).finally(() => {
        activeDownloads.value--
        processDownloadQueue()
      })
    } else {
      window.electronAPI.downloadDirectory(item.remotePath!, item.dirLocalPath!, item.tabId, item.dirBaseTransferId!).then((result: any) => {
        if (result.success) {
          transferStore.completeTransfer(item.dirBaseTransferId!)
          ElMessage.success('文件夹下载成功')
        } else {
          transferStore.failTransfer(item.dirBaseTransferId!, result.error || '下载失败')
        }
      }).catch((err: Error) => {
        transferStore.failTransfer(item.dirBaseTransferId!, err.message)
      }).finally(() => {
        activeDownloads.value--
        processDownloadQueue()
      })
    }
  }
}

const downloadFile = async (item: FileItem | null) => {
  if (!item) return;
  const tabId = getTabId();
  if (!tabId) {
    ElMessage.warning('请先连接到服务器');
    return;
  }

  try {
    if (item.isDirectory) {
      // 文件夹下载：加入队列
      const dialogResult = await window.electronAPI.showDirectoryDialog();
      if (dialogResult.canceled || !dialogResult.filePaths?.[0]) return;
      const localPath = dialogResult.filePaths[0] + '/' + item.label;

      const baseTransferId = transferStore.addTransfer({
        tabId,
        name: item.label + '/',
        path: item.path,
        type: 'download',
        size: 0,
      });

      if (activeDownloads.value >= settingsStore.maxConcurrentDownloads) {
        transferStore.transfers.find(t => t.id === baseTransferId)!.status = 'waiting'
      }
      downloadQueue.value.push({
        id: baseTransferId, tabId, type: 'directory',
        remotePath: item.path, dirLocalPath: localPath, dirBaseTransferId: baseTransferId
      })
      processDownloadQueue()
    } else {
      // 单文件下载：加入队列
      const dialogResult = await window.electronAPI.showSaveDialog({defaultName: item.label});
      if (dialogResult.canceled || !dialogResult.filePath) return;

      const transferId = transferStore.addTransfer({
        tabId,
        name: item.label,
        path: item.path,
        type: 'download',
        size: item.size || 0,
      });

      if (activeDownloads.value >= settingsStore.maxConcurrentDownloads) {
        transferStore.transfers.find(t => t.id === transferId)!.status = 'waiting'
      }
      downloadQueue.value.push({
        id: transferId, tabId, type: 'file',
        remotePath: item.path, localPath: dialogResult.filePath
      })
      processDownloadQueue()
    }
  } catch (error) {
    ElMessage.error('下载失败：' + (error as Error).message);
  }
};

// 上传文件到当前目录（工具栏按钮）
const uploadToCurrent = async () => {
  const tabId = getTabId();
  if (!tabId) {
    ElMessage.warning('请先连接到服务器');
    return;
  }

  await uploadFile(tabId, currentPath.value);
};

// 上传文件到指定目录（右键菜单）
const uploadToDir = async (item: FileItem | null) => {
  if (!item || !item.isDirectory) return;
  const tabId = getTabId();
  if (!tabId) {
    ElMessage.warning('请先连接到服务器');
    return;
  }

  await uploadFile(tabId, item.path);
};

// 通用上传逻辑
const uploadFile = async (tabId: string, targetDir: string) => {
  try {
    const dialogResult = await window.electronAPI.showOpenDialog();
    if (dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) return;

    const localPath = dialogResult.filePaths[0];
    const fileName = localPath.split(/[/\\]/).pop() || '';
    const remotePath = targetDir === '/' ? '/' + fileName : targetDir + '/' + fileName;

    // 获取文件大小
    const sizeResult = await window.electronAPI.getFileSize(localPath);
    const fileSize = sizeResult.success ? sizeResult.size : 0;

    // 添加到传输记录
    const transferId = transferStore.addTransfer({
      tabId,
      name: fileName,
      path: remotePath,
      type: 'upload',
      size: fileSize,
    });
    transferStore.startTransfer(transferId);

    const result = await window.electronAPI.uploadFile(localPath, remotePath, tabId, transferId);
    if (result.success) {
      transferStore.completeTransfer(transferId);
      ElMessage.success('文件上传成功');
      loadDirectoryContent(currentPath.value);
      refreshTree();
    } else {
      transferStore.failTransfer(transferId, '上传失败');
      ElMessage.error('文件上传失败');
    }
  } catch (error) {
    ElMessage.error('上传失败：' + (error as Error).message);
  }
};

// 拖入上传
const onDragOver = (e: DragEvent) => {
  if (e.dataTransfer?.types.includes('Files')) {
    isDragOver.value = true;
  }
};
const onDragLeave = () => {
  isDragOver.value = false;
};
const onDrop = async (e: DragEvent) => {
  isDragOver.value = false;
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;
  const tabId = getTabId();
  if (!tabId) {
    ElMessage.warning('请先连接到服务器');
    return;
  }
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // Electron 的 File 对象有 path 属性
    const localPath = (file as any).path;
    if (!localPath) continue;
    const fileName = localPath.split(/[/\\]/).pop() || file.name;
    const targetDir = currentPath.value;
    const remotePath = targetDir === '/' ? '/' + fileName : targetDir + '/' + fileName;

    // 添加到传输记录
    const transferId = transferStore.addTransfer({
      tabId,
      name: fileName,
      path: remotePath,
      type: 'upload',
      size: file.size || 0,
    });
    transferStore.startTransfer(transferId);

    try {
      await window.electronAPI.uploadFile(localPath, remotePath, tabId);
      transferStore.completeTransfer(transferId);
      ElMessage.success(`${fileName} 上传成功`);
    } catch (error) {
      transferStore.failTransfer(transferId, `${fileName} 上传失败`);
      ElMessage.error(`${fileName} 上传失败：${(error as Error).message}`);
    }
  }
  loadDirectoryContent(currentPath.value);
  refreshTree();
};

// 新建文件夹
const newFolder = () => {
  newFolderName.value = '';
  showNewFolderDialog.value = true;
};
const doNewFolder = async () => {
  if (!newFolderName.value) return;
  const tabId = getTabId();
  if (!tabId) {
    ElMessage.warning('请先连接到服务器');
    return;
  }
  const targetPath = currentPath.value === '/' ? '/' + newFolderName.value : currentPath.value + '/' + newFolderName.value;
  try {
    const result = await window.electronAPI.executeCommand(`mkdir -p "${targetPath}"`, tabId);
    if (result.success) {
      ElMessage.success('文件夹创建成功');
      showNewFolderDialog.value = false;
      loadDirectoryContent(currentPath.value);
      refreshTree();
    } else {
      ElMessage.error('创建失败');
    }
  } catch (error) {
    ElMessage.error('创建失败：' + (error as Error).message);
  }
};

// 新建文件
const newFile = () => {
  newFileName.value = '';
  showNewFileDialog.value = true;
};
const doNewFile = async () => {
  if (!newFileName.value) return;
  const tabId = getTabId();
  if (!tabId) {
    ElMessage.warning('请先连接到服务器');
    return;
  }
  const targetPath = currentPath.value === '/' ? '/' + newFileName.value : currentPath.value + '/' + newFileName.value;
  try {
    const result = await window.electronAPI.executeCommand(`touch "${targetPath}"`, tabId);
    if (result.success) {
      ElMessage.success('文件创建成功');
      showNewFileDialog.value = false;
      loadDirectoryContent(currentPath.value);
      refreshTree();
    } else {
      ElMessage.error('创建失败');
    }
  } catch (error) {
    ElMessage.error('创建失败：' + (error as Error).message);
  }
};

// 打开（目录=导航，文件=用本地程序打开）
const openItem = (item: FileItem | null) => {
  if (!item) return;
  if (item.isDirectory) {
    currentPath.value = item.path;
    loadDirectoryContent(item.path);
    expandTreePath(item.path);
  } else {
    openFileWithLocalProgram(item);
  }
};

// 用本地程序打开文件
const openFileWithLocalProgram = async (item: FileItem) => {
  try {
    // 先下载到临时目录
    const saveResult = await window.electronAPI.showSaveDialog({ defaultName: item.label });
    if (saveResult.canceled || !saveResult.filePath) return;

    await window.electronAPI.downloadFile(item.path, saveResult.filePath, props.tabId || '');

    // 用本地程序打开
    const result = await window.electronAPI.openFileWithSystem(saveResult.filePath);
    if (!result.success) {
      ElMessage.error('打开失败：' + result.error);
    }
  } catch (error) {
    ElMessage.error('打开失败：' + (error as Error).message);
  }
};

// 权限修改
const changePermissions = (item: FileItem | null) => {
  if (!item) return;
  permissionItem.value = item;
  // 从当前权限字符串解析（如 drwxr-xr-x → 755）
  const modeStr = item.mode || '';
  const parsePerm = (offset: number) => ({
    r: modeStr.length > offset + 1 ? modeStr[offset + 1] === 'r' : true,
    w: modeStr.length > offset + 2 ? modeStr[offset + 2] === 'w' : true,
    x: modeStr.length > offset + 3 ? modeStr[offset + 3] === 'x' : false,
  });
  permOwner.value = parsePerm(0);
  permGroup.value = parsePerm(3);
  permOther.value = parsePerm(6);
  showPermissionDialog.value = true;
};
const doChangePermissions = async () => {
  const item = permissionItem.value;
  const tabId = getTabId();
  if (!item || !tabId) return;
  try {
    const recursive = item.isDirectory ? ' -R' : '';
    const result = await window.electronAPI.executeCommand(`chmod${recursive} ${permNumeric.value} "${item.path}"`, tabId);
    if (result.success) {
      ElMessage.success('权限修改成功');
      showPermissionDialog.value = false;
      loadDirectoryContent(currentPath.value);
    } else {
      ElMessage.error('权限修改失败');
    }
  } catch (error) {
    ElMessage.error('权限修改失败：' + (error as Error).message);
  }
};

const deleteItem = async (item: FileItem | null) => {
  if (!item) return;
  const tabId = getTabId();
  if (!tabId) {
    ElMessage.warning('请先连接到服务器');
    return;
  }

  try {
    await ElMessageBox.confirm(
        `确定要删除 ${item.isDirectory ? '目录' : '文件'} "${item.label}" 吗？`,
        '确认删除',
        {type: 'warning'}
    );

    if (item.isDirectory) {
      const result = await window.electronAPI.executeCommand(`rm -rf "${item.path}"`, tabId);
      if (result.success) {
        ElMessage.success('删除成功');
      } else {
        ElMessage.error('删除失败');
      }
    } else {
      const result = await window.electronAPI.executeCommand(`rm "${item.path}"`, tabId);
      if (result.success) {
        ElMessage.success('删除成功');
      } else {
        ElMessage.error('删除失败');
      }
    }

    loadDirectoryContent(currentPath.value);
  } catch {
  }
};

const showRenameDialog = (item: FileItem | null) => {
  if (!item) return;
  contextMenuItem.value = item;
  renameInput.value = item.label;
  showRenameDialogFlag.value = true;
};

const renameItem = async () => {
  const item = contextMenuItem.value;
  const tabId = getTabId();
  if (!item || !tabId || !renameInput.value) return;

  try {
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '/';
    const newPath = parentPath === '/' ? '/' + renameInput.value : parentPath + '/' + renameInput.value;

    const result = await window.electronAPI.executeCommand(`mv "${item.path}" "${newPath}"`, tabId);
    if (result.success) {
      ElMessage.success('重命名成功');
      loadDirectoryContent(currentPath.value);
    } else {
      ElMessage.error('重命名失败');
    }
  } catch (error) {
    ElMessage.error('重命名失败：' + (error as Error).message);
  } finally {
    showRenameDialogFlag.value = false;
  }
};

const refreshTree = async () => {
  loading.value = true;
  const tabId = getTabId();

  if (!tabId) {
    isConnected.value = false;
    ElMessage.warning('请先连接到服务器');
    loading.value = false;
    return;
  }

  try {
    const normalizedPath = normalizePath(currentPath.value);
    const testResult = await window.electronAPI.listDirectory(normalizedPath, tabId);

    if (!testResult.success) {
      isConnected.value = false;
      ElMessage.warning('无法访问文件系统：' + (testResult.error || '未知错误'));
      return;
    }

    isConnected.value = true;
    loadDirectoryContent(normalizedPath);

    ElMessage.success('刷新成功');
  } catch (error) {
    isConnected.value = false;
    ElMessage.error('刷新失败：' + (error as Error).message);
  } finally {
    loading.value = false;
  }
};

const goToTerminal = () => {
  window.dispatchEvent(new CustomEvent('switch-menu', {detail: 'terminal'}));
};

watch(() => getActiveTabId(), () => {
  const tabId = getTabId();
  isConnected.value = !!tabId;
  if (tabId) {
    loadDirectoryContent(currentPath.value);
  }
});

// 监听传输进度
const handleTransferProgress = (data: {
  tabId: string; type: string; transferred: number; total: number;
  transferId?: string; dirStart?: { totalFiles: number; totalSize: number };
  dirFileDone?: string; dirFileIndex?: number; dirTotalFiles?: number
}) => {
  const currentTabId = getTabId()
  if (data.tabId !== currentTabId || !data.transferId) return

  const transfer = transferStore.transfers.find(t => t.id === data.transferId)
  if (!transfer) return

  // 文件夹开始：设置总大小 + 文件数
  if (data.dirStart) {
    transfer.size = data.dirStart.totalSize
    transfer.name = transfer.name.replace(/\/$/, ` (${data.dirStart.totalFiles} 个文件)`)
    return
  }

  // 文件夹进度：实时更新字节 + 速度 + 文件计数
  if (data.dirFileDone) {
    transfer.transferred = data.transferred
    transfer.size = data.total
    if (data.dirFileIndex && data.dirTotalFiles) {
      const baseName = transfer.name.replace(/ \(\d+\/\d+ 个文件\)$/, '').replace(/ \(\d+ 个文件\)$/, '')
      transfer.name = `${baseName} (${data.dirFileIndex}/${data.dirTotalFiles} 个文件)`
    }
    // 更新速度
    const now = Date.now()
    if (transfer._lastSpeedTime && transfer._lastTransferred !== undefined) {
      const dt = (now - transfer._lastSpeedTime) / 1000
      if (dt >= 0.5) {
        transfer.speed = Math.round((data.transferred - transfer._lastTransferred) / dt)
        transfer._lastTransferred = data.transferred
        transfer._lastSpeedTime = now
      }
    } else {
      transfer._lastTransferred = data.transferred
      transfer._lastSpeedTime = now
    }
    return
  }

  // 普通单文件进度
  transferStore.updateProgress(data.transferId, data.transferred, data.total)
}

onMounted(() => {
  window.addEventListener('mousedown', handleMouseSideButtons);
  window.addEventListener('mouseup', handleMouseSideButtons);
  window.electronAPI.onTransferProgress(handleTransferProgress);
  refreshTree();
});

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', handleMouseSideButtons);
  window.removeEventListener('mouseup', handleMouseSideButtons);
  window.electronAPI.removeListener('transfer-progress', handleTransferProgress);
});

const handleMouseSideButtons = (event: MouseEvent) => {
  if (event.type === 'mousedown') {
    if (event.button === 3) {
      event.preventDefault();
      goBack();
    } else if (event.button === 4) {
      event.preventDefault();
      goForward();
    }
  }
};
</script>

<style scoped>
.file-browser {
  height: 100%;
}

.file-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.close-btn {
  flex-shrink: 0;
}

.card-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.path-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.path-input {
  flex: 1;
}

.path-root-btn {
  cursor: pointer;
  transition: color 0.2s;
}

.path-root-btn:hover {
  color: var(--el-color-primary);
}

.copy-btn {
  padding: 0 4px;
  min-height: auto;
}

.copy-btn:hover {
  color: var(--el-color-primary);
}

.browser-container {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 1px;
  background-color: var(--el-border-color);
}

.tree-panel {
  width: 220px;
  background-color: var(--el-bg-color);
  overflow: hidden;
}

.tree-container {
  height: 100%;
  overflow: auto;
  padding: 8px;
}

.not-connected {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.directory-tree {
  background-color: transparent;
}

.tree-node-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.list-panel {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.symlink-arrow {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

:deep(.el-tree-node__content) {
  height: 28px;
}

:deep(.el-tree-node__content:hover) {
  background-color: var(--el-fill-color-light);
}

/* 拖入上传覆盖层 */
.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: rgba(64, 158, 255, 0.08);
  border: 3px dashed var(--el-color-primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.drop-text {
  font-size: 16px;
  color: var(--el-color-primary);
  font-weight: 500;
}

/* 右键菜单触发定位元素 */
.context-menu-trigger {
  position: fixed;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}

/* el-dropdown 菜单项图标间距 */
.context-menu-icon {
  margin-right: 4px;
}

/* 权限对话框 */
.perm-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.perm-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.perm-label {
  width: 56px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.perm-row label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  cursor: pointer;
}

.perm-numeric {
  margin-top: 12px;
  font-size: 13px;
  color: var(--el-color-primary);
  font-family: 'Consolas', monospace;
}
</style>
