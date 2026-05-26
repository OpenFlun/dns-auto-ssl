import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runLego } from './lego.js';
import { setupRenewTask } from './renew-task.js';

function getDefaultCertPath() {
    const home = os.homedir();
    return path.join(home, '.dns-auto-ssl', 'certs');
}

/**
 * 申请证书 (使用 lego v5 run 命令)
 * @param {Object} options
 * @param {string} options.email
 * @param {string|string[]} options.domains
 * @param {string} options.dnsProvider - DNS 服务商代码 (与 lego 官方一致)
 * @param {Object} options.apiEnv - API 密钥环境变量，如 { ALICLOUD_ACCESS_KEY: 'xxx', ... }
 * @param {string} [options.certPath] - 自定义证书存储目录
 * @param {boolean} [options.wildcard=false] - 是否自动添加通配符
 * @param {boolean} [options.setupRenew=true] - 是否配置自动续期任务
 * @param {boolean} [options.staging=false] - 是否使用 Let's Encrypt Staging 环境
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
        staging = false,
    } = options;

    if (!email) throw new Error('缺少邮箱 (email)');
    if (!rawDomains) throw new Error('缺少域名 (domains)');
    if (!dnsProvider) throw new Error('缺少 DNS 服务商 (dnsProvider)');

    let domains = Array.isArray(rawDomains) ? rawDomains : [rawDomains];
    if (wildcard) {
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

    const certBaseDir = userCertPath || getDefaultCertPath();
    const legoWorkDir = path.join(certBaseDir, 'lego');
    fs.mkdirSync(legoWorkDir, { recursive: true });

    // 构建 lego 参数 (v5: run 命令在前，选项在后)
    const legoArgs = [
        'run',
        '--accept-tos',
    ];
    if (staging) {
        legoArgs.push('--server', 'https://acme-staging-v02.api.letsencrypt.org/directory');
    }
    legoArgs.push(
        '--email', email,
        '--domains', domains.join(','),
        '--dns', dnsProvider,
        '--path', legoWorkDir,
    );

    console.log(`正在申请证书，域名: ${domains.join(', ')}`);
    // 直接透传 apiEnv 中的所有环境变量
    await runLego(legoArgs, apiEnv);

    const firstDomain = domains[0];
    const certFile = path.join(legoWorkDir, 'certificates', `${firstDomain}.crt`);
    const keyFile = path.join(legoWorkDir, 'certificates', `${firstDomain}.key`);
    if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
        throw new Error('证书文件生成失败，未找到 .crt/.key 文件');
    }

    let renewTaskConfigured = false;
    if (setupRenew) {
        await setupRenewTask({
            email,
            domains,
            dnsProvider,
            apiEnv,        // 透传 apiEnv，用于续期任务
            certPath: legoWorkDir,
            staging,
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