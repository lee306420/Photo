# Photo

这是一个使用Electron框架开发的桌面照片管理应用程序"照片管理器"。该应用程序具有以下特点和功能：

1. **基本框架**：使用Electron构建的跨平台桌面应用，可以在macOS上运行。

2. **主要功能**：
   - 照片导入与管理
   - 按日期（年/月/日）组织和分类照片
   - 照片搜索功能
   - 照片查看器（支持触摸滑动操作）
   - 自定义存储位置设置

3. **技术栈**：
   - Electron作为桌面应用框架
   - 前端使用原生HTML/CSS/JavaScript
   - 使用了Font Awesome图标库
   - 使用了一些照片处理库（如sharp、heic-convert等）
   - 使用了CodeMirror和Markdown支持

4. **项目结构**：
   - `src/`：源代码目录
   - `src/main.js`：Electron主进程代码
   - `src/renderer.js`：渲染进程的主要JavaScript代码
   - `src/index.html`：应用的主界面
   - `src/components/`：组件目录，包含如PhotoViewer等组件
   - `src/utils/`：工具目录，包含数据管理、照片导入等功能

5. **用户界面**：
   - 左侧边栏：用于导入照片、设置存储位置和按日期浏览
   - 主内容区：显示按日期分组的照片
   - 搜索功能：可以搜索照片或视频

6. **数据管理**：
   - 可自定义照片存储位置
   - 支持照片元数据的保存和加载

这个应用是一个本地照片管理工具，可以帮助用户按照时间线整理和查看照片，提供简洁的浏览和搜索功能。

![1931740467648_ pic_hd](https://github.com/user-attachments/assets/d86cc245-0066-4235-b877-eb9dc80dc0ad)
