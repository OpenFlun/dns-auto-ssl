import path from 'node:path';
import fs from 'node:fs';
import { runLego } from './lego.js';
import { setupRenewTask } from './renew-task.js';

/**
 * 申请证书
 * @param {Object} options
 * @param {string} options.email - 邮箱
 * @param {string|string[]} options.domains - 域名列表
 * @param {string} options.dnsProvider - DNS 服务商代码 (alidns, dnspod, cloudflare 等)
 * @param {Object} options.apiEnv - API 密钥环境变量对象，如 { ALICLOUD_ACCESS_KEY: 'xxx', ALICLOUD_SECRET_KEY: 'yyy' }
 * @param {string} [options.certPath] - 证书存储目录，默认为系统推荐的全局目录
 * @param {boolean} [options.wildcard] - 是否自动添加通配符 *.domain（需要用户确认）
 * @param {boolean} [options.setupRenew=true] - 是否配置自动续期任务
 * @returns {Promise<{domains: string[], certPath: string, keyPath: string, renewTaskConfigured: boolean}>}
 */
export async function setupCertificate(options) {
    const {
        email,
        domains: rawDomains,
        dnsProvider,
        apiEnv,
        certPath: userCertPath,
        wildcard = false,
        setupRenew = true,
    } = options;

    if (!email) throw new Error('缺少邮箱 (email)');
    if (!rawDomains) throw new Error('缺少域名 (domains)');
    if (!dnsProvider) throw new Error('缺少 DNS 服务商 (dnsProvider)');
    if (!apiEnv || Object.keys(apiEnv).length === 0) {
        throw new Error('缺少 API 密钥环境变量 (apiEnv)');
    }

    let domains = Array.isArray(rawDomains) ? rawDomains : [rawDomains];
    if (wildcard) {
        // 为每个非通配符域名添加通配符子域（如果用户没有显式提供 *.domain）
        const newDomains = [...domains];
        for (const d of domains) {
            if (!d.startsWith('*.')) {
                const wildcardDomain = `*.${d}`;
                if (!newDomains.includes(wildcardDomain)) {
                    newDomains.push(wildcardDomain);
                }
            }
        }
        domains = newDomains;
    }

    // 确定证书存储路径
    const certBaseDir = userCertPath || getDefaultCertPath();
    const legoPath = path.join(certBaseDir, 'lego'); // lego 工作目录（账户信息等）
    fs.mkdirSync(legoPath, { recursive: true });

    // 构建 lego run 命令参数
    const legoArgs = [
        '--email', email,
        '--domains', domains.join(','),
        '--dns', dnsProvider,
        '--path', legoPath,
        'run',
    ];

    console.log(`正在申请证书，域名: ${domains.join(', ')}`);
    await runLego(legoArgs, apiEnv);

    // 证书文件位于 ${legoPath}/certificates/${firstDomain}.crt/.key
    const firstDomain = domains[0];
    const certFile = path.join(legoPath, 'certificates', `${firstDomain}.crt`);
    const keyFile = path.join(legoPath, 'certificates', `${firstDomain}.key`);
    if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
        throw new Error('证书文件生成失败，未找到 .crt/.key 文件');
    }

    let renewTaskConfigured = false;
    if (setupRenew) {
        await setupRenewTask({
            email,
            domains,
            dnsProvider,
            apiEnv,
            certPath: legoPath,
        });
        renewTaskConfigured = true;
    }

    return {
        domains,
        certPath: certFile,
        keyPath: keyFile,
        renewTaskConfigured,
    };
}

function getDefaultCertPath() {
    const home = os.homedir();
    return path.join(home, '.dns-auto-ssl', 'certs');
}