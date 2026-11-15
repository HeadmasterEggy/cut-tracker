import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// data/log.json 留在仓库原位置（tools/log.py 写它），网页运行时 fetch 'data/log.json'。
// 开发时直接从磁盘读；打包时原样复制到 dist/data/log.json。
const LOG = resolve(__dirname, 'data/log.json');
function logJson(): Plugin {
  return {
    name: 'cut-tracker-log-json',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !/\/data\/log\.json(\?|$)/.test(req.url)) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(LOG));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'data/log.json', source: readFileSync(LOG) });
    },
  };
}

export default defineConfig({
  // 相对路径：同一份产物放在 GitHub Pages 的 /cut-tracker/ 子路径和 Vercel 的根路径都能用
  base: './',
  plugins: [logJson()],
  build: { outDir: 'dist', emptyOutDir: true },
});
