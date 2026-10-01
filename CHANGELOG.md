# 变更日志

## [1.1.1] - 2026-10-01 11:33

### Fixed
- 修复 Electron 等无控制台环境下启动应用时反复弹出命令行黑窗的问题：`lib/shard.js` 中 `execPromise` 包装层默认注入 `windowsHide: true`
- 修复证书缺失/过期触发 `lego` 时可能弹出的命令行黑窗：`lib/lego.js` 中 `spawn` 显式加上 `windowsHide: true`

[1.1.1]: https://github.com/OpenFlun/dns-auto-ssl/compare/v1.1.0...v1.1.1

## [1.1.0] - 2026-09-30 22:39

### Added
- Windows 平台自动生成 `.pfx`（自动探测 openssl：PATH → Qt → OpenSSL-Win64 → Git 自带）
- `setup()` 新增 `pfxPassword` 参数（默认 `iisPass789`），控制 PFX 密码
- `setup()` 返回值新增 `pfxPath`，方便直接喂给 IIS
- 生成的 `域名.bat` / `域名.sh` 内置证书指纹比对，指纹变化时才执行部署逻辑（部署逻辑预留于包源码中）
- 证书 `.crt` 缺失时自动清理 lego 元数据并重新申请

### Changed
- Windows 计划任务运行身份从 `SYSTEM` 改为当前用户（`S4U` + `Highest`），避免用户目录权限问题
- Windows bat 强制 CRLF 换行，避免中文注释被 cmd 错误解析

### Fixed
- 修复 lego 4.16+ ARI `replaces` 字段导致的 403 错误（新增 `--ari-disable`）
- 修复 lego 续期前随机休眠 10 分钟的问题（新增 `--no-random-sleep`）
- 修复 lego 失败仍刷新时间戳、导致自愈机制失效的问题（bat 新增退出码检查，失败即 `exit /b 1`）
- 修复 bat 中 `if exist (...)` 块内含中文时语法错位的问题

### 优化
- 同步优化了相关文件,详情请自行查看;

[1.1.0]: https://github.com/OpenFlun/dns-auto-ssl/compare/v1.0.14...v1.1.0

## [1.0.14] - 2026-09-29 16:42
### 优化
- 加固了拷贝文件的一些逻辑;

## [1.0.13] - 2026-09-20 11:48
### 优化
- 优化了'copy-files.js'的判断逻辑;