# 代码墓地桌面版 / Code Cemetery Desktop

## 普通用户

Windows 10/11 64 位：运行 `Code-Cemetery-版本号-Setup-x64.exe` 安装，之后双击桌面上的 **Code Cemetery**。也可以解压 Windows ZIP，双击解压目录里的 `Code Cemetery.exe`。请完整解压并保留旁边的 resources 等目录。

桌面发行包自带 Electron/Node.js 运行环境和 Git，无需单独安装 Node.js、Git，也不用打开浏览器、输入网址或保留命令行窗口。

- 本地项目：点击“发现项目” → “本地目录” → “选择文件夹” → “开始扫描”。只识别具有 `.git` 的仓库，最多查找 5 层子目录；普通代码文件夹暂不识别。
- GitHub：选择“GitHub 仓库”，输入用户名。公开仓库不需要登录；自己的私有仓库可在“访问私有仓库”中填写只读访问令牌，再扫描同一个账号的用户名。
- 导出：打开“年度祭典”，生成预览后点击“保存到电脑”，选择 PNG 保存位置。
- 语言：右上角“中 / EN”切换。

本地扫描、编辑和 PNG 导出可离线使用；GitHub 扫描需要网络。应用只读取 Git 信息，不修改、删除或上传原项目代码。

项目与设置保存在当前系统账号的应用数据目录 `Code Cemetery/state.json`；GitHub 令牌单独由系统加密保存为 `github-token.bin`，不进入项目记录或导出图片。Windows 使用系统提供的 DPAPI 加密；同一登录账号下的其他程序仍可能有能力解密，请保护自己的系统账号。

安装包和源码打包使用明确的文件范围，不包含开发电脑的 `.data/`、`.env`、截图或真实项目记录。新用户首次打开看到的是虚构示例。桌面版与旧版 Web 服务的数据分开保存，需要在桌面版重新选择项目目录扫描。旧版记录仍留在原位置。

当前 Windows 构建没有商业代码签名证书。公开发布前可由维护者使用自己的证书签名；不要建议用户关闭系统安全保护。macOS/Linux 尚未制作或验证发行包。

## 开发和构建

开发机器安装 Node.js 24；安装依赖时需要联网下载 Electron 和 dugite 内置 Git。GitHub 受网络限制时需配置开发机器可用的标准代理；不要在源码中填写代理凭据。

```sh
npm ci --include=dev
npm run desktop
npm run dist:desktop
```

如果包管理器跳过了安装脚本，先运行 `npm rebuild electron dugite`。输出在 `release/`：Windows 安装包、免安装 ZIP 和 `win-unpacked/` 应用目录。不要将整个开发目录当作发行包。

桌面进程从本地文件加载界面，数据操作走受限 IPC，不启动 HTTP 监听端口。界面使用隔离上下文和沙箱；文件选择、PNG 保存、令牌加密与 Git 执行均在主进程完成。原 Web 版保留用于开发与兼容。

## English

Run the Windows x64 Setup executable, or fully extract the Windows ZIP and open `Code Cemetery.exe`. No Node.js, Git, browser, terminal or server setup is required for end users. Use **Discover → Local folder → Choose folder** to scan Git repositories. Enter your GitHub username for public repositories; optionally save a read-only access token for your own private repositories. Posters are saved through a native Save dialog.

Project records stay in the current user's application-data directory. Tokens use operating-system encryption and never appear in posters or project records. Local features work offline. Only GitHub scans require internet access. This build is unsigned; macOS/Linux distributions have not been tested.
