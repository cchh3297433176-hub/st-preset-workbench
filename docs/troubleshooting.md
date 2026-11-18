# 踩坑与交接记录

## 手机下载与覆盖安装

- ChatGPT 附件在安卓端反复显示「有错误，请稍后重试」，有一次旧附件路径也已失效。仓库目前提供固定的下载入口，登录有权限的 GitHub 账号后优先从这里取包。 [Termux 安装包](../downloads/preset-workbench-termux-menu.zip)
- GitHub 的 **Download raw file** 下载单独安装包 `preset-workbench-termux-menu.zip`。仓库首页的 **Code → Download ZIP** 下载整个仓库，文件名通常是 `st-preset-workbench-main.zip`，安装包在仓库 ZIP 的 `st-preset-workbench-main/downloads/` 下面。两种 ZIP 外层结构不同，对应的安装命令也不同。
- Termux 报 `unzip: cannot find or open` 时，先运行 `ls -1 ~/storage/downloads | grep -Ei 'workbench|\.zip$'`。核对实际文件名、下载目录和系统自动加的 `(1)` 等后缀。路径有空格时用双引号括起来。
- 用整个仓库 ZIP 时，先取出里面的安装包，再安装到 `~/SillyTavern/data/default-user/extensions`。安装前用 `unzip -tq` 检查包，并读包内 `preset-workbench/manifest.json` 核对目标版本，避免成功解压了旧包。单独安装包的命令见 [README](../README.md)。
- 一张截图可以同时包含旧的「安装成功」和后一次覆盖失败。以最后一次命令及已安装的 `~/SillyTavern/data/default-user/extensions/preset-workbench/manifest.json` 版本为准。

## 左下角菜单与真实数据

- 手机顶部工具区容易挤满，安装后从聊天输入框左下角的 **☰ → 预设工作台** 进入。覆盖安装后，先刷新原酒馆页面，再从这个入口重新打开工作台。
- 能打开工作台，只验证了扩展入口。看到示例内容时，检查工具栏是否有 **从酒馆选预设**，然后选一份真实预设并点 **载入草稿**。
- `0.1.1` 增加左下角入口，`0.1.2` 增加读取已保存的聊天补全预设。世界书另有 **从酒馆选世界书** 入口，需要启用酒馆助手。保留原酒馆标签页，工作台通过同源酒馆页面读取数据，编辑结果进入草稿。
- 2026-11-18 手机实测：用户已能在工作台看到酒馆里的预设。首次打开或使用「继续聊」时，默认仍显示测试预设，容易让人以为没有连上。
- 下一步：从酒馆入口打开时，默认显示酒馆当前使用的聊天补全预设。若已有未保存草稿，先保留草稿并让用户选择是否切换。验收时分别测试首次打开、切换酒馆当前预设后重新打开，以及有未保存草稿的情况。

## 长任务怎么换窗口

- 从 [文件目录表](../FILE-INDEX.md) 选相关文件。先核对仓库、分支和最新提交，再按行查看有关源码。大包、构建产物、压缩 JS 和 Base64 由脚本处理，只回传必要摘要。
- 当前 Work 窗口的助手拿不到实时上下文余量。遇到长任务，可以在功能交付或排查暂停时留一段短交接，记下仓库、分支、提交、涉及路径、最后一个实测结果和下一步。
- 接手这个项目时，先读根目录 `FILE-INDEX.md` 和这份记录。安装目录是 `~/SillyTavern/data/default-user/extensions/preset-workbench`。代码以 GitHub 当前分支为准，手机结果以用户实测为准。
