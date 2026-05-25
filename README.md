# @flun/windows

本工具库能将您的 Node.js 应用程序作为 Windows 后台服务来运行和管理,支持服务的安装、启动、停止及卸载全流程;还提供事件日志等功能,它主要用于面向生产环境应用程序的部署与运维;如需联系,邮箱: [cn@flun.top](mailto:cn@flun.top)

### 本包基于 ESM 模块系统编写->拥抱未来趋势

- **推荐方式**：使用 `import` / `export` 语法,静态分析更友好,工具链兼容性最佳;
- **兼容方式**：Node.js ≥ 23.5.0 原生支持 `require(esm)`;22.12+ 需开启 `--experimental-require-module` 标志;
- **重要**：本文档所有示例均采用 **ESM 标准**,请确保你的项目 `package.json` 中已设置 `"type": "module"`,或将脚本后缀改为 `.mjs`;

## 功能概述

@flun/windows 提供以下功能：

- **服务管理**：将 Node.js 脚本作为原生 Windows 服务运行（含监控功能）
- **事件日志**：写入 Windows 事件日志
- **系统命令**：
  - _权限提升_：以管理员权限运行命令(会触发 UAC 确认)
  - _Sudo 执行_：以管理员身份执行命令
  - _权限检测_：检测当前用户是否具有管理员权限
  - _进程列表_：列出运行中的 Windows 进程/服务
  - _终止进程_：通过 PID 终止特定进程

## 安装

推荐通过 npm 全局安装：`npm i -g @flun/windows`

然后在项目根目录执行：`npm link @flun/windows`

局部安装:`npm i @flun/windows`

---

# ✅ 如何使用

### CLI 方式
```bash
npx @flun/dns-auto-ssl --email me@example.com --domains example.com,www.example.com --provider alidns --api-key xxx --api-secret yyy --wildcard
```

### 函数参数方式

```js
import { setup } from '@flun/dns-auto-ssl';

const result = await setup({
  email: 'me@example.com',
  domains: ['example.com', '*.example.com'],
  dnsProvider: 'alidns',
  apiEnv: {
    ALICLOUD_ACCESS_KEY: 'xxx',
    ALICLOUD_SECRET_KEY: 'yyy'
  },
  wildcard: false,
  setupRenew: true
});

console.log(result.certPath, result.keyPath);
```

# 许可证
@flun/windows 核心代码采用 ISC 许可证（具体内容请见许可证文档）