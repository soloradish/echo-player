# Echo Player

Echo Player 是一个专注于“再听一次”和快速循环的 Windows 语言学习播放器。v0.1.0 只处理本地媒体，不上传文件，也不包含遥测。

## 功能

- 打开或拖放 MP4、M4V、WebM、MP3、M4A、AAC、WAV、FLAC 和 OGG。
- 只读取所选文件及其同目录的支持格式文件，生成临时播放列表。
- 使用内置 FFmpeg 在本机生成波形和基于停顿的片段。
- 支持上一段、下一段、带前置缓冲的重听、整段循环、当前片段循环和波形 A–B 循环。
- 支持 0.5×–2.0× 倍速、音量、全屏、段间停顿和四种界面语言。

播放列表不递归扫描子目录；媒体结束后停在当前文件，不会自动切换下一项。关闭应用后不会保留最近播放的文件，只保留音量、倍速、循环停顿和语言偏好。

## 系统要求

- Windows 10 或 Windows 11
- Microsoft Edge WebView2 Runtime（Windows 10/11 通常已包含）

正式安装包已经包含固定版本的 LGPL FFmpeg，不需要用户另行安装，也不包含代码签名。Windows 可能因此显示 SmartScreen 警告；请从项目的 GitHub Releases 获取安装包并核对 `SHA256SUMS.txt`。

## 本地开发

项目固定使用 Node.js 24.16.0 和 Rust 1.96.0。安装依赖后，FFmpeg 准备脚本会下载锁定的构建、校验 SHA-256，并拒绝 GPL/nonfree 配置。

```powershell
npm ci
npm run ffmpeg:prepare
npm run tauri:dev
```

常用验证命令：

```powershell
npm test
npm run build
npm audit --audit-level=high

cd src-tauri
cargo fmt --all -- --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
cargo audit
```

浏览器布局预览可运行 `npm run dev` 并访问 `/?demo=1`。该模式不包含本地文件权限和真实音频分析。

## Windows 原生 E2E

端到端测试构建只在 `e2e` feature 下加入 WebDriver 插件；正式安装包不包含测试接口。

```powershell
npm run build:e2e
npm run test:e2e:tauri
```

GitHub Actions 在托管的 `windows-2022` runner 上执行前端测试、Rust 测试、依赖审计和原生 Tauri E2E。标签发布工作流还会在 `windows-2022` 与 `windows-2025` 上静默安装、启动并卸载未签名的 NSIS 安装包，然后发布校验和与构建来源证明。

## 发布

版本号必须同时保持在 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 一致。全部 CI 门禁通过后再创建版本标签；推送 `v*` 标签会触发发布工作流。

本项目不使用 Authenticode 证书。发布产物会明确保持未签名，并提供 SHA-256 校验和及 GitHub artifact attestation。

## 许可证

项目代码采用 [MIT License](LICENSE)。内置 FFmpeg 的来源、重建信息和许可证说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 与 `scripts/ffmpeg-lock.json`。
