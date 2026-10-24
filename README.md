# @flun/dns-auto-ssl

**一键申请 + 自动续期 SSL 证书(基于 Let's Encrypt + lego v5)**

本工具通过 DNS API 自动完成 Let's Encrypt 证书的申请和续期配置,**无需开放 80/443 端口**,支持通配符证书,覆盖 Windows / 
Linux / macOS,且已内置 lego 二进制文件,**零网络依赖安装**;

如有问题或建议,请联系 [open@flun.top](mailto:open@flun.top)

---

## 核心特性

- ✅ **全自动**:一次配置,自动申请 + 自动续期(每天 03:00 + 每次登录时检查)
- ✅ **零网络依赖**:已预置各平台 lego v5 二进制文件,安装即用
- ✅ **支持通配符**:一键申请 `*.example.com` 证书
- ✅ **跨平台**:Windows(计划任务)/ Linux & macOS(crontab)自动续期
- ✅ **Windows 专用 PFX**:自动探测 openssl,静默生成 `.pfx`,可直接喂给 IIS
- ✅ **自愈机制**:lego 失败不刷新时间戳,下次调用自动重装任务并重新申请
- ✅ **任意 DNS 服务商**:支持 lego 全部 180+ 种 DNS API(阿里云、腾讯云、Cloudflare、AWS Route53 等)
- ✅ **ESM 原生**:基于现代 JavaScript 模块系统

> **Node.js 版本要求**:≥22.12.0(推荐 23.5.0+ 以获得最佳 ESM 支持)

---

## 配置

### 允许安装脚本执行

本包在安装时可能触发某些依赖包的自动脚本(如 `postinstall` 等);如果你的 npm 全局配置或项目配置禁止了脚本执行(例如设置了 
`ignore-scripts=true`),可能会导致安装不完整或运行时异常;

推荐在项目根目录的 `package.json` 中添加 `allowScripts` 字段,显式放行本包及其依赖的脚本:

```json
{
  "allowScripts": {
    "@flun/dns-auto-ssl": true
    // 如果依赖的其它包(如 bcrypt、electron-winstaller 等)也有脚本,请按需添加,格式相同
  }
}
```

> 如果你信任所有安装包,也可以直接在项目 `.npmrc` 中设置 `allow-scripts = false`(表示关闭脚本拦截,所有脚本均允许执行),
  或删除 `ignore-script`字段;

---

## 安装

```bash
# 全局安装
npm i -g @flun/dns-auto-ssl

# 或者局部安装
npm i @flun/dns-auto-ssl
```

---

## 快速开始

### 1. 获取 DNS API 密钥(以常见服务商为例)

| DNS 服务商          | `--provider` 参数值 | 所需环境变量(通过 `--env` 或 `apiEnv` 传入)                          |
| ------------------- | ------------------- | ---------------------------------------------------------------------- |
| **阿里云**          | `alidns`            | `ALICLOUD_ACCESS_KEY`<br>`ALICLOUD_SECRET_KEY`                         |
| **腾讯云 (DNSPod)** | `dnspod`            | `TENCENTCLOUD_SECRET_ID`<br>`TENCENTCLOUD_SECRET_KEY`                  |
| **Cloudflare**      | `cloudflare`        | `CF_API_TOKEN`                                                         |
| **AWS Route53**     | `route53`           | `AWS_ACCESS_KEY_ID`<br>`AWS_SECRET_ACCESS_KEY`<br>`AWS_REGION`(可选) |
| **GoDaddy**         | `godaddy`           | `GODADDY_API_KEY`<br>`GODADDY_API_SECRET`                              |
| **Namecheap**       | `namecheap`         | `NAMECHEAP_API_USER`<br>`NAMECHEAP_API_KEY`                            |

> 更多服务商请查阅 [lego DNS 提供商列表](https://go-acme.github.io/lego/dns/),找到对应的 `provider` 名称和环境变量;

### 2. 申请证书

#### 方式一:CLI(命令行)

> **💡 Windows 用户特别注意**
> - 以下示例默认给出**单行命令**,可直接复制到 PowerShell 或 cmd 中运行;
> - 不要使用反斜杠 `\` 换行(那仅适用于 Linux/macOS 的 bash/zsh);
> - 如果密钥值包含特殊字符(如 `=`、空格、`&`),请用双引号包裹整个 `KEY=value`:`--env "KEY=value with spaces"`;

**全局安装后**(推荐):
```bash
# 阿里云示例(同时申请裸域和通配符)
dns-auto-ssl --email you@example.com --domains example.com --provider alidns \
  --env ALICLOUD_ACCESS_KEY=你的AccessKeyId --env ALICLOUD_SECRET_KEY=你的AccessKeySecret --wildcard

# 腾讯云 DNSPod 示例
dns-auto-ssl --email you@example.com --domains example.com --provider dnspod \
  --env TENCENTCLOUD_SECRET_ID=你的SecretId --env TENCENTCLOUD_SECRET_KEY=你的SecretKey

# Cloudflare 示例
dns-auto-ssl --email you@example.com --domains example.com --provider cloudflare --env CF_API_TOKEN=你的Token
```

**使用 npx(无需全局安装)**:
```bash
npx @flun/dns-auto-ssl --email you@example.com --domains example.com --provider alidns \
  --env ALICLOUD_ACCESS_KEY=你的AccessKeyId --env ALICLOUD_SECRET_KEY=你的AccessKeySecret --wildcard
```

> **多行命令写法(仅适用于 Linux / macOS bash/zsh)**
> 若你更喜欢多行,可以使用反斜杠换行:
> ```bash
> dns-auto-ssl \
>   --email you@example.com \
>   --domains example.com \
>   --provider alidns \
>   --env ALICLOUD_ACCESS_KEY=你的AccessKeyId \
>   --env ALICLOUD_SECRET_KEY=你的AccessKeySecret \
>   --wildcard
> ```
> **Windows PowerShell 用户请勿使用反斜杠**,请使用上面给出的单行命令,或使用反引号 `` ` `` 换行(不推荐,易出错);

**参数说明**

| 参数          | 说明                                                     | 必填 |
| ------------- | -------------------------------------------------------- | ---- |
| `--email`     | 你的邮箱(用于 Let's Encrypt 通知)                      | ✅    |
| `--domains`   | 域名,多个用逗号分隔(如 `example.com,www.example.com`) | ✅    |
| `--provider`  | DNS 服务商代码(与 lego 官方命名一致,如上表)           | ✅    |
| `--env`       | 设置所需的环境变量,格式 `KEY=value`,可重复多次         | ✅    |
| `--wildcard`  | 为每个裸域自动添加通配符域名(`*.example.com`)          | 可选 |
| `--cert-path` | 自定义证书存储目录(默认 `~/.dns-auto-ssl/certs/lego`)  | 可选 |
| `--no-renew`  | 不配置自动续期任务                                       | 可选 |
| `--staging`   | 使用 Let's Encrypt 测试环境(避免速率限制,适用于调试)  | 可选 |

#### 方式二:Node.js API(局部安装)

```javascript
// 1. 导入核心模块
import { setup } from '@flun/dns-auto-ssl';
import fs from 'node:fs';
import { X509Certificate } from 'node:crypto';

// 2. 直接调用 setup 函数(顶层 await,无需 async 包装)
const { domains, certPath, keyPath, pfxPath, renewTaskConfigured } = await setup({
        // ---------- 必填项 ----------
        email: 'you@example.com',                    // 你的邮箱,用于 Let's Encrypt 通知
        domains: ['example.com', 'www.example.com'], // 需要证书的域名列表(支持多个)
        dnsProvider: 'alidns',                       // DNS 服务商代码:阿里云=alidns,腾讯云=dnspod,Cloudflare=cloudflare

        // ---------- API 密钥(根据 dnsProvider 选择对应的键值对)----------
        apiEnv: {
                // 如果你使用[阿里云],请填写以下两项,并注释掉其他服务商的配置
                ALICLOUD_ACCESS_KEY: '你的AccessKeyId',     // 阿里云 RAM 用户的 AccessKey ID
                ALICLOUD_SECRET_KEY: '你的AccessKeySecret', // 阿里云 RAM 用户的 AccessKey Secret

                // 如果你使用[腾讯云 DNSPod],请取消注释以下两项,并注释掉阿里云的部分
                // TENCENTCLOUD_SECRET_ID: '你的SecretId',     // 腾讯云 API 密钥的 SecretId
                // TENCENTCLOUD_SECRET_KEY: '你的SecretKey',   // 腾讯云 API 密钥的 SecretKey

                // 如果你使用[Cloudflare],请取消注释以下一项,并注释掉其他部分
                // CF_API_TOKEN: '你的Cloudflare APIToken',    // Cloudflare API Token(需要 Zone:DNS:Edit 权限)
        },

        // ---------- 可选参数 ----------
        // certPath: '自定义路径',          // 自定义证书路径(默认安装在你的用户主目录下)
        wildcard: true,                    // 是否自动添加通配符域名(例如 *.example.com,默认 false)
        setupRenew: true,                  // 是否配置系统自动续期任务(默认 true)
        staging: false,                    // 是否使用 Let's Encrypt 测试环境(正式环境请保持默认 false)
        pfxPassword: 'iisPass789',         // Windows PFX 密码(仅 Windows 生效,默认 'iisPass789')
});

// 3. 打印申请结果
console.log('✅ 证书申请成功!');
console.log('涵盖域名:', domains.join(', '));
console.log('证书文件路径:', certPath);
console.log('私钥文件路径:', keyPath);
console.log('Windows PFX 路径:', pfxPath);  // 仅 Windows 平台文件真实存在
console.log('自动续期任务已配置:', renewTaskConfigured);

// 4. 可选:验证证书是否包含目标域名
const cert = new X509Certificate(fs.readFileSync(certPath));
if (cert.subjectAltName?.includes(`DNS:${domains[0]}`)) console.log('✓ 验证通过(包含目标域名)');

// 导出结果供其它模块使用(注意如果有导出需求建议注释或删除步骤3和4的验证代码,避免无畏的文件读取和证书解析)
export { domains, certPath, keyPath, pfxPath };
```

> **注意**:`apiEnv` 中的**键名必须与上表中的环境变量名称完全一致**(区分大小写);不同的 DNS 服务商需要提供不同的键值对;

---

## 证书存放位置与使用

默认证书存储目录:

- **Windows**: `%USERPROFILE%\.dns-auto-ssl\certs\lego\certificates\`
- **Linux/macOS**: `~/.dns-auto-ssl/certs/lego/certificates/`

证书文件:
- `yourdomain.crt`  – 证书文件
- `yourdomain.key`  – 私钥文件
- `yourdomain.pfx`  – Windows 专用 PFX(**仅 Windows 平台自动生成**,密码由 `pfxPassword` 指定,默认 `iisPass789`)
- `yourdomain.issuer.crt` – 中间证书(lego 自动生成)
- `yourdomain.json` – lego 元数据

在你的 Node.js 项目中使用:

```javascript
import https from 'node:https';
import fs from 'node:fs';
import { domains, certPath, keyPath } from './DnsAutoSSL.js';
// 注意这是根据局部安装模块后默认示例的导出配置(示例内容请自行改为实际参数)

const options = {
  key: fs.readFileSync(keyPath, 'utf8'),
  cert: fs.readFileSync(certPath, 'utf8')
};
const mainDomains = domains[0]; // 定义主域名

https.createServer(options, (req, res) => {
  res.end('Hello HTTPS!');
}).listen(443);
```

> **权限提示**:监听 443 端口需要管理员/root 权限;Linux 下可使用 `sudo`,Windows 需以管理员身份运行终端;

### Windows 专用:PFX 与 IIS

在 Windows 上,`setup()` 会在证书生成或更新后,自动探测 openssl 并静默生成 `.pfx`(探测顺序:PATH → Qt → OpenSSL-Win64 → Git 
自带 → 其它常见路径);用户无需任何配置;

拿到 `pfxPath` 后,可直接导入 IIS:

```powershell
$pw = ConvertTo-SecureString 'iisPass789' -AsPlainText -Force
Import-PfxCertificate -FilePath "C:\Users\你\.dns-auto-ssl\certs\lego\certificates\example.com.pfx" -CertStoreLocation `
  Cert:\LocalMachine\My -Password $pw
```

或交给 IIS 绑定:

```powershell
Import-Module WebAdministration
$cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*example.com*" } | Select-Object -First 1
Get-WebBinding -Protocol https | ForEach-Object { $_.AddSslCertificate($cert.Thumbprint, 'My') }
```

> **openssl 未找到时**:`setup()` 会 warn 并跳过 PFX 生成,不影响证书申请和续期;安装任意 openssl 到 PATH 
  或上述常见路径即可自动恢复;

---

## 自动续期机制

- 证书有效期为 90 天,续期任务会在证书到期前 **30 天** 内自动更新
- **Windows**:计划任务在每天凌晨 **03:00** 以及**每次用户登录时**各检查一次
- **Linux / macOS**:crontab 每天凌晨 **03:00** 执行
- **自愈机制**:lego 执行失败时不会刷新时间戳;下次调用 `setup()` 时检测到时间戳过期,会自动重装任务并重新申请证书
- **证书缺失自恢复**:若 `.crt` 被误删,续期任务会自动清理 lego 元数据并重新申请
- **PFX 自动重建**:Windows 平台证书指纹变化时,`.pfx` 会自动重新生成
- **无需任何干预**,只要 DNS API 密钥仍然有效即可

**验证续期任务是否添加成功**

- **Linux/macOS**: `crontab -l | grep dns-auto-ssl`
- **Windows**: 打开"任务计划程序" → 查找以主域名命名的计划任务名

**查看续期日志**

- **Windows**: `%USERPROFILE%\.dns-auto-ssl\域名.renew.log`
- **Linux/macOS**: `~/.dns-auto-ssl/域名.log`

> 💡 若需立即测试续期,可手动执行续期脚本(Windows:`%USERPROFILE%\.dns-auto-ssl\域名.bat`;Linux/macOS:
  `~/.dns-auto-ssl/域名.sh`)

---

## 常见踩坑与解决方案

### ❌ 错误:`flag provided but not defined: -email`

**原因**:lego v5 要求 `run` 命令必须放在最前面;本工具已内置正确顺序,如果遇到此错误请确认你使用的是最新版本的 
`@flun/dns-auto-ssl`,或者你直接调用了 lego 二进制;

### ❌ 错误:`403 :: urn:ietf:params:acme:error:unauthorized :: Could not validate ARI 'replaces' field`

**原因**:lego 4.16+ 默认启用 ARI(ACME Renewal Information)续期信息,续期时会发送 `replaces` 字段;当本地 lego 的 ARI 
状态与服务端不一致(账号变更、证书目录被清理、lego 升级等),就会 403;

**解决**:本工具已内置 `--ari-disable`,如遇此错误请升级到最新版本;

### ❌ 错误:`too many certificates already issued for this exact set of identifiers`

**原因**:Let's Encrypt 生产环境对同一域名每周有 **5 次** 证书申请限制,测试时频繁申请会触发;

**解决方案**:
- 使用 `--staging` 参数(测试环境无速率限制)
- 或更换一个未申请过的域名
- 等待一周后重试

### ❌ 错误:`no such host` / `getaddrinfo ENOTFOUND`

**原因**:DNS 服务商代码拼写错误,或网络无法访问 Let's Encrypt API;

**解决**:检查 `--provider` 参数是否与 lego 官方命名一致(如 `alidns` 而非 `aliyun`);
参考 [lego 全部提供商列表](https://go-acme.github.io/lego/dns/);

### ❌ 错误:`DNS problem: SERVFAIL looking up TXT for _acme-challenge.xxx`

**原因**:Let's Encrypt 的验证服务器查询 `_acme-challenge` 的 TXT 记录时,权威 DNS 返回错误;常见原因:

- 阿里云 DNS 中残留 `_acme-challenge` 记录与本次生成的记录冲突
- 存在 CAA 记录禁止 Let's Encrypt 签发
- DNSSEC 配置问题

**解决**:登录 DNS 服务商控制台,检查并清理 `_acme-challenge` 和 CAA 记录;如开启 DNSSEC,可暂时关闭后重试;

### ❌ 错误:`EACCES: permission denied` 监听 443 端口

**解决**:
- **Linux/macOS**:使用 `sudo node server.js`
- **Windows**:以管理员身份运行命令提示符或 PowerShell

### ⚠️ Windows 未生成 `.pfx`

本工具自动探测 openssl:

1. 先查 PATH(`where openssl`)
2. 再查常见路径:
   - `C:\Qt\Tools\OpenSSL\bin\bin\openssl.exe`
   - `C:\Program Files\OpenSSL-Win64\bin\openssl.exe`
   - `C:\Program Files\Git\usr\bin\openssl.exe`(Git 自带)
   - 等

都找不到时会 warn 并跳过 PFX,**不影响证书申请和续期**;安装任意 openssl 到 PATH 或上述路径即可自动恢复;

### ❌ Windows PowerShell 中执行多行命令报错:`Missing expression after unary operator '--'`

**原因**:PowerShell 不支持反斜杠 `\` 作为换行符,且 `--` 在 PowerShell 中有特殊含义;

**解决方案**:
- **使用单行命令**(推荐):将所有参数写在一行,去掉反斜杠;
- 如果必须换行,请使用反引号 `` ` ``,但容易出错,不推荐;
- 或者切换到**命令提示符 (cmd)**,cmd 使用 `^` 作为换行符;

示例(正确):
```powershell
# 单行(直接复制)
dns-auto-ssl --email you@example.com --domains example.com --provider alidns --env ALICLOUD_ACCESS_KEY=xxx `
  --env ALICLOUD_SECRET_KEY=yyy

# 如果未全局安装,使用 npx
npx @flun/dns-auto-ssl --email you@example.com --domains example.com --provider alidns --env ALICLOUD_ACCESS_KEY=xxx `
  --env ALICLOUD_SECRET_KEY=yyy
```

### ⚠️ 通配符证书生效范围

- 申请 `*.example.com` 可以保护 `www.example.com`、`api.example.com` 等所有**一级子域名**
- **不会**保护 `example.com`(裸域);如需同时保护,请将 `example.com` 也加入 `--domains` 列表

示例:`--domains example.com,*.example.com`

### ⚠️ 环境变量安全

- **不要**将 API 密钥硬编码在代码中,推荐使用 `--env` 参数或 `.env` 文件
- **Windows**:密钥明文保存在 `%USERPROFILE%\.dns-auto-ssl\域名.bat` 中,请确保系统安全(一般仅限本地)
- **Linux/macOS**:环境变量同样明文出现在 crontab 和 `~/.dns-auto-ssl/域名.sh` 中,建议控制服务器访问权限

### ⚠️ 续期任务不执行怎么办?

1. 检查系统时间是否正确(证书续期依赖系统时间)
2. 查看续期日志:Windows `%USERPROFILE%\.dns-auto-ssl\域名.renew.log`;Linux/macOS `~/.dns-auto-ssl/域名.log`
3. 手动执行续期脚本,观察错误输出
4. 确保 DNS API 密钥仍然有效且未过期
5. 检查网络是否能正常访问 Let's Encrypt API
6. 若脚本丢失或损坏,重新运行 `setup()` 即可(时间戳过期后会自动重装)

### ⚠️ 切换 DNS 服务商时的注意事项

如果你之前使用阿里云申请证书,现在想改用腾讯云,需要**确保 `--provider` 和对应的环境变量同时更改**;例如:

```bash
# 之前阿里云
dns-auto-ssl --provider alidns --env ALICLOUD_ACCESS_KEY=xxx ...

# 改为腾讯云后
dns-auto-ssl --provider dnspod --env TENCENTCLOUD_SECRET_ID=xxx --env TENCENTCLOUD_SECRET_KEY=yyy ...
```

---

## 清理

```bash
# 删除证书和账户数据(可选)
rm -rf ~/.dns-auto-ssl                 # Linux/macOS
rmdir /s %USERPROFILE%\.dns-auto-ssl   # Windows
```

> 清理后需重新运行 `setup()` 或 CLI 才能重新申请证书并安装续期任务;

---

## 许可证

ISC License

---

## 贡献与反馈

欢迎提交 Issue 或 Pull Request 至 [GitHub 仓库](https://github.com/OpenFlun/dns-auto-ssl)

邮箱: [open@flun.top](mailto:open@flun.top)