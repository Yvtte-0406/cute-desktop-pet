# 阿泠 · 白色九尾狐桌宠

阿泠是Windows本地静音桌宠，用于陪伴和待办提醒。形象为纯白蓬松九尾狐、雾紫色眼睛与花钿、软绳悬挂一枚银铃。

![阿泠的笑眼](previews/closed-face.png)

## 已实现

- 连续待机、眨眼、静音说话、点击抚摸和拖拽托起；闭眼保留原有脸型。
- 九条尾巴使用各自的透明图层、尾根和摆动相位，保留确认原图的毛发宽度与尾尖。当前小尺寸下待机摆幅偏小，增强效果将单独试调。
- 右键打开狐狸上方的弧形菜单：待办、大小、退出；展开时不移动或缩放狐狸。
- 待办填写事项和选填截止时间，已添加事项只提供删除。可勾选每30分钟提醒，使用活泼文案并优先列出较早截止事项。
- 大小范围40%–150%，自动保存；透明区域能点击到下方桌面。
- 内置单实例运行，重复打开会显示现有桌宠。

没有养成、换装或小游戏；不读取屏幕、个人文件或私人日程。没有配置模型API，也没有AI判断紧急程度的功能。提醒目前由本地逻辑运行，无API费用。日期问候、农历节气提示和硬编码节假日均已移除。

## 运行与打包

此仓库提供源码。Windows上安装Node.js和npm后：

```powershell
npm ci
npm start
```

构建可独立运行的Windows程序：

```powershell
npm run package
```

构建完成后双击 `dist/win-unpacked/阿泠.exe`。运行打包版无需另装Node.js。请保留整个 `win-unpacked` 文件夹，不能只复制其中的exe；可自行创建桌面快捷方式。依赖、构建产物和用户任务不提交到仓库。

待办与设置保存在当前用户 `%APPDATA%/white-fox-desktop-pet`，应用改名不会清空已有数据。尚未加入开机自启动。

## Windows时间设置只读识别

独立工具 `tools/inspect-system-time.ps1` 使用Windows NLS及系统时区接口，读取当前用户的区域、默认历法、日期/时间格式和每周起始日；结果输出为JSON，不修改设置，不使用在线服务或固定年份日历。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/inspect-system-time.ps1
```

这是诊断工具，尚未集成进桌宠。默认历法与任务栏附加日历不是同一设置；无法读出的附加日历或节假日数据不会被假定为已识别。

## 验证和后续方案

```powershell
npm run check
npm test
```

已有检查覆盖连续动作、固定脸型、拖拽回稳、窗口大小、待办保存、截止时间表述与提醒计时。开发用 `verify.cjs` 和 `verify-native.cjs` 进一步检查截图、原图尾巴像素保真、透明点击和右键菜单稳定性。

[需求与实现](docs/requirements.md) · [待确认的AI与日历方案](docs/proposals.md) · [素材说明](docs/asset-prompts.md)

AI优先级和动态提醒仍是待确认方案；不会自动启用计费服务或把任务发送给模型。
