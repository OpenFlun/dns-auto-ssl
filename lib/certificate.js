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
 * @param {string} options.dnsProvider - DNS 服务商代码 (alidns, dnspod, cloudflare 等)
 * @param {Object} options.apiEnv - API 密钥环境变量，如 { ALICLOUD_ACCESS_KEY: 'xxx', ALICLOUD_SECRET_KEY: 'yyy' }
 * @param {string} [options.certPath] - 自定义证书存储目录
 * @param {boolean} [options.wildcard=false] - 是否自动添加通配符
 * @param {boolean} [options.setupRenew=true] - 是否配置自动续期任务
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
    const legoWorkDir = path.join(certBaseDir, 'lego'); // lego 工作目录（账户信息等）
    fs.mkdirSync(legoWorkDir, { recursive: true });

    // v5 统一使用 run 命令
    const legoArgs = [
        '--email', email,
        '--domains', domains.join(','),
        '--dns', dnsProvider,
        '--path', legoWorkDir,
        'run',
    ];

    console.log(`正在申请证书，域名: ${domains.join(', ')}`);
    await runLego(legoArgs, apiEnv);

    // 证书文件位于 ${legoWorkDir}/certificates/${firstDomain}.crt/.key
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
            apiEnv,
            certPath: legoWorkDir,
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