import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
export default defineConfig({
    plugins: [vue()],
    base: './',
    server: {
        host: 'localhost',
        port: 5173,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src/renderer'),
        },
    },
    build: {
        outDir: 'dist/renderer',
    },
    optimizeDeps: {
        include: ['element-plus'],
    },
});
