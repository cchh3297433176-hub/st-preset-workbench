# 文件目录表

| 文件 | 用途 | 按需一起查看 |
| --- | --- | --- |
| `README.md` | GitHub 下载、Termux 安装、酒馆入口和使用说明 | `manifest.json` |
| `FILE-INDEX.md` | 文件用途和按需检出方法 | |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | 下载、覆盖安装、真实数据读取与换窗口交接的踩坑记录 | `README.md`、`manifest.json` |
| `manifest.json` | SillyTavern 扩展名称、版本、加载入口 | `index.js` |
| `index.js` | 挂载酒馆左下角菜单，打开同源工作台 | `manifest.json`、`dist/index.html` |
| `dist/index.html` | 工作台页面、基础样式与脚本加载顺序 | `dist/workbench-core.js`、`dist/editor-v2.css` |
| `dist/workbench-core.js` | 基础页面、事件、草稿状态、本地保存 | `dist/index.html`、`dist/editor-v2.js` |
| `dist/editor-v2.js` | 条目编辑、参考选择、数字定位和移动 | `dist/editor-v2.css`、`dist/draft-insert.js` |
| `dist/editor-v2.css` | 条目编辑和定位选择器的响应式布局 | `dist/editor-v2.js` |
| `dist/compatibility-ui.js` | 预设与参考文件导入导出、柏宝箱分组、酒馆助手脚本 | `dist/preset-document.js` |
| `dist/preset-document.js` | 预设、世界书和脚本的格式转换与字段保留 | `tests/preset-document.test.cjs` |
| `dist/draft-insert.js` | 缝合与世界书转预设的预览和批量插入 | `dist/editor-v2.js`、`dist/preset-document.js` |
| `dist/tavern-world-source.js` | 读取当前及已保存的酒馆聊天补全预设，通过酒馆助手读取世界书 | `dist/draft-insert.js`、`dist/preset-document.js` |
| `dist/workbench-ai.js` | AI 模型选择、ST-ApiManager 分组读取、会话和修改建议 | `dist/tavern-world-source.js`、`dist/editor-v2.js` |
| `dist/sortable.min.js` | SortableJS 第三方构建文件 | `dist/sortable-LICENSE.txt` |
| `dist/sortable-LICENSE.txt` | SortableJS 的 MIT 许可证 | |
| `tests/preset-document.test.cjs` | 预设往返、分组、顺序和脚本保存测试 | `dist/preset-document.js` |
| `docs/01-完整开发需求.md` | 完整需求与验收边界 | |
| `docs/03-预设缝合与智能编辑专题.md` | 缝合、依赖和编辑设计 | |
| `downloads/preset-workbench-termux-menu.zip` | 手机上可直接解压安装的扩展包 | 发布更新时与运行文件一起更新 |

## 按需检出

有私有仓库权限的 Git 环境可以先只取目录表，再按任务添加指定文件。以下以修改酒馆菜单为例。

```bash
git clone --filter=blob:none --no-checkout https://github.com/cchh3297433176-hub/st-preset-workbench.git
cd st-preset-workbench
git sparse-checkout set --no-cone /FILE-INDEX.md
git checkout main
git sparse-checkout add --no-cone /index.js /manifest.json
```

格式层测试需要检出 `/dist/preset-document.js` 与 `/tests/preset-document.test.cjs`，运行 `node tests/preset-document.test.cjs`。整站运行需要完整的 `dist/`。
