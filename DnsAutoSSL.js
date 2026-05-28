import { setup } from '@flun/dns-auto-ssl';
import fs from 'node:fs';
import { X509Certificate } from 'node:crypto';

// 2. 直接调用 setup 函数（顶层 await，无需 async 包装）
const { domains, certPath, keyPath, renewTaskConfigured } = await setup({
	// ---------- 必填项 ----------
	email: 'you@example.com',                    // 你的邮箱，用于 Let's Encrypt 通知
	domains: ['example.com', 'www.example.com'], // 需要证书的域名列表（支持多个）
	dnsProvider: 'alidns',                       // DNS 服务商代码：阿里云=alidns，腾讯云=dnspod，Cloudflare=cloudflare

	// ---------- API 密钥（根据 dnsProvider 选择对应的键值对）----------
	apiEnv: {
		// 如果你使用【阿里云】，请填写以下两项，并注释掉其他服务商的配置
		ALICLOUD_ACCESS_KEY: '你的AccessKeyId',     // 阿里云 RAM 用户的 AccessKey ID
		ALICLOUD_SECRET_KEY: '你的AccessKeySecret', // 阿里云 RAM 用户的 AccessKey Secret

		// 如果你使用【腾讯云 DNSPod】，请取消注释以下两项，并注释掉阿里云的部分
		// TENCENTCLOUD_SECRET_ID: '你的SecretId',     // 腾讯云 API 密钥的 SecretId
		// TENCENTCLOUD_SECRET_KEY: '你的SecretKey',   // 腾讯云 API 密钥的 SecretKey

		// 如果你使用【Cloudflare】，请取消注释以下一项，并注释掉其他部分
		// CF_API_TOKEN: '你的Cloudflare APIToken',    // Cloudflare API Token（需要 Zone:DNS:Edit 权限）
	},

	// ---------- 可选参数 ----------
	// certPath: '自定义路径', // 自定义证书路径（默认安装在你的用户主目录下）
	wildcard: true,       // 是否自动添加通配符域名（例如 *.example.com,默认 false）
	setupRenew: true,     // 是否配置系统自动续期任务（默认 true，每天凌晨3点检查）
	staging: false,       // 是否使用 Let's Encrypt 测试环境（用于避免速率限制,正式环境请保持默认的 false）
});

// 3. 打印申请结果
console.log('✅ 证书申请成功！');
console.log('涵盖域名:', domains.join(', '));
console.log('证书文件路径:', certPath);
console.log('私钥文件路径:', keyPath);
console.log('自动续期任务已配置:', renewTaskConfigured);

// 4. 可选：验证证书是否包含目标域名
const cert = new X509Certificate(fs.readFileSync(certPath));
if (cert.subjectAltName?.includes(`DNS:${domains[0]}`)) console.log('✓ 验证通过(包含目标域名)');

// 导出结果供其他它模块使用(注意如果有导出需求建议注释或删除步骤3和4的验证代码,避免无畏的文件读取和证书解析)
export { domains, certPath, keyPath };