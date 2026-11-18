# 酒馆预设工作台 · Termux 试装

需要能正常打开的 SillyTavern，以及已启用、提供世界书读取接口的酒馆助手。

1. 下载 ZIP 到 Android 的 Download 目录，确认 Termux 已获得共享存储权限。如果还没有，执行 `termux-setup-storage` 并授权。解压需要 `unzip`（缺少时可用 `pkg install unzip`）。
2. 在 Termux 中进入自己的 SillyTavern 安装目录。默认单用户目录通常是 `data/default-user`。如用了其他账号，将下方路径改成相应目录。
3. 同一条命令可用于首次安装或覆盖旧版工作台。

```bash
cd ~/SillyTavern && test -f package.json && test -d data/default-user &&
mkdir -p data/default-user/extensions &&
unzip -tq ~/storage/downloads/preset-workbench-termux-menu.zip &&
unzip -oq ~/storage/downloads/preset-workbench-termux-menu.zip -d data/default-user/extensions &&
echo '安装成功'
```

刷新酒馆，点聊天输入框左下角的「☰」，选择「预设工作台」。保留原酒馆标签页。工作台里点「从酒馆选世界书」，选一本书后勾条目、选编号并加入草稿。如果要导出为完整预设，先在「预设库」导入你的目标预设 JSON。

世界书读取和转换在当前酒馆地址完成。读取入口只调用酒馆助手的查询接口，插入只改浏览器草稿。草稿与线上预览分属不同地址，如需迁移已有草稿，可在原预览中导出预设 JSON 后在本地导入。

如果没有看到入口，先确认扩展管理里已启用「酒馆预设工作台」与「酒馆助手」，然后刷新酒馆再从左下角菜单打开工作台。

## 载入酒馆预设

从酒馆左下角菜单打开工作台，在工作区点「从酒馆选预设」。列表读取酒馆已保存的聊天补全预设，当前预设排在最前。选中后确认「载入草稿」，再编辑、审阅和导出。

## 从 GitHub 下载

登录有仓库权限的 GitHub 账号，打开 [Termux 安装包](downloads/preset-workbench-termux-menu.zip)，点击 **Download raw file**。保存到手机的「下载」目录后执行上面的安装命令。

开发前先看 [文件目录表](FILE-INDEX.md)。
