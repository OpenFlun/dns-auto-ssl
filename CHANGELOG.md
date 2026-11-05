# 变更日志

## [2.0.2] - 2026-11-05 09:39
### 优化
- 说明文件命令章节补 ### 命令 表（setup/example/help）,原 ### 参数 改为 ### setup 参数

## [2.0.1] - 2026-11-04 21:49
### 优化
- 内部细节优化;
- 新增恢复示例指令;

## [2.0.0] - 2026-10-30 10:04
### 更改
- CLI 改为子命令形态,命令名保持 `dns-auto-ssl`,业务子命令为 `setup`,与主入口唯一导出 `setup` 对应;
- 破坏性变更:原 `dns-auto-ssl -e ... -d ...` 平铺用法改为 `dns-auto-ssl setup -e ... -d ...`;
- 帮助输出统一由手写 printHelp 生成,格式对齐 env、desktop-builder:中文用法行 + 子命令 + setup 选项;
- 无参数、help、-h、--help、setup --help 均输出同一份帮助,退出码 0;
- 未知命令、未知选项先报错再打印同一份帮助,退出码 1,无需用户再执行一次帮助指令;

### 新增
- `setup` 子命令补齐 `--pfx-password` 选项,对应 setup 的 pfxPassword 参数(默认 iisPass789);