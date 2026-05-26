import { setup } from '@flun/dns-auto-ssl';
import { env } from '@flun/env';
import fs from 'fs';

try {
	const result = await setup({
		email: 'china@lunjack.com',
		domains: ['kdg.123xyz.cn'],
		dnsProvider: 'alidns',
		apiEnv: {
			ALICLOUD_ACCESS_KEY: env.ALI_ACCESS_KEY_ID,
			ALICLOUD_SECRET_KEY: env.ALI_ACCESS_KEY_SECRET
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
	if (certContent.includes('kdg.123xyz.cn')) {
		console.log('✓ 证书内容包含目标域名');
	}
} catch (err) {
	console.error('❌ 失败:', err.message);
	process.exit(1);
}