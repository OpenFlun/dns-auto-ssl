# @flun/dns-auto-ssl

本工具库自动通过 DNS API 申请 Let's Encrypt SSL 证书并配置跨平台自动续期（基于 lego v5）。;如需联系,邮箱: [cn@flun.top](mailto:cn@flun.top)

### 本包基于 ESM 模块系统编写->拥抱未来趋势

- **推荐方式**：使用 `import` / `export` 语法,静态分析更友好,工具链兼容性最佳;
- **兼容方式**：Node.js ≥ 23.5.0 原生支持 `require(esm)`;22.12+ 需开启 `--experimental-require-module` 标志;
- **重要**：本文档所有示例均采用 **ESM 标准**,请确保你的项目 `package.json` 中已设置 `"type": "module"`,或将脚本后缀改为 `.mjs`;

## 功能概述

@flun/dns-auto-ssl 提供以下功能：


## 安装

全局安装：`npm i -g @flun/dns-auto-ssl`

局部安装:`npm i @flun/dns-auto-ssl`

---

# ✅ 如何使用

### CLI 方式
```bash
dns-auto-ssl --email me@example.com --domains example.com --provider alidns --api-key xxx --api-secret yyy --wildcard
```

### 函数参数方式

```js
import { setup } from '@flun/dns-auto-ssl';
import fs from 'fs';

try {
  const result = await setup({
    email: 'your-email@example.com',
    domains: ['example.com', 'www.example.com'],          // 替换为你的真实测试域名
    dnsProvider: 'alidns',                  // 根据服务商修改
    apiEnv: {
       ALICLOUD_ACCESS_KEY: 'xxx',
       ALICLOUD_SECRET_KEY: 'yyy'
    },
    wildcard: false,                        // 是否自动添加通配符
    setupRenew: true,                       // 配置自动续期任务
  });

  // 打印域名列表
  console.log('✅ 证书申请成功');
  console.log('涵盖域名:', result.domains.join(', '));
  console.log('证书文件路径:', result.certPath);
  console.log('私钥文件路径:', result.keyPath);

  // 可选：验证证书文件真实存在且包含域名信息
  const certContent = fs.readFileSync(result.certPath, 'utf8');
  if (certContent.includes('www.example.com')) {
    console.log('✓ 证书内容包含目标域名');
  }
} catch (err) {
  console.error('❌ 失败:', err.message);
  process.exit(1);
}
```

# 许可证
@flun/dns-auto-ssl 核心代码采用 ISC 许可证（具体内容请见许可证文档）