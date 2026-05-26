#!/usr/bin/env node

import { Command } from 'commander';
import { setup } from '../index.js';
import { runLego, getLegoPath } from '../lib/lego.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const program = new Command();

program
    .name('dns-auto-ssl')
    .description('自动通过 DNS API 申请 SSL 证书并配置自动续期 (基于 lego v5)')
    .option('-e, --email <email>', '邮箱地址 (必填)')
    .option('-d, --domains <domains>', '域名，多个用逗号分隔 (必填)')
    .option('-p, --provider <provider>', 'DNS 服务商 (alidns, dnspod, cloudflare) (必填)')
    .option('--api-key <key>', 'API Key ID')
    .option('--api-secret <secret>', 'API Secret')
    .option('--api-token <token>', 'API Token (Cloudflare)')
    .option('--cert-path <path>', '证书存储路径')
    .option('--wildcard', '自动添加通配符域名')
    .option('--no-renew', '不配置自动续期')
    .action(async (options) => {
        const { email, domains, provider, apiKey, apiSecret, apiToken, certPath, wildcard, renew } = options;
        if (!email || !domains || !provider) {
            console.error('错误: --email, --domains, --provider 为必填参数');
            process.exit(1);
        }

        let apiEnv = {};
        if (provider === 'alidns') {
            if (!apiKey || !apiSecret) throw new Error('阿里云需要 --api-key 和 --api-secret');
            apiEnv = { ALICLOUD_ACCESS_KEY: apiKey, ALICLOUD_SECRET_KEY: apiSecret };
        } else if (provider === 'dnspod') {
            if (!apiKey || !apiSecret) throw new Error('DNSPod 需要 --api-key 和 --api-secret');
            apiEnv = { TENCENTCLOUD_SECRET_ID: apiKey, TENCENTCLOUD_SECRET_KEY: apiSecret };
        } else if (provider === 'cloudflare') {
            if (!apiToken) throw new Error('Cloudflare 需要 --api-token');
            apiEnv = { CF_API_TOKEN: apiToken };
        } else {
            console.error(`不支持的 DNS 服务商: ${provider}`);
            process.exit(1);
        }

        try {
            const result = await setup({
                email,
                domains: domains.split(','),
                dnsProvider: provider,
                apiEnv,
                certPath,
                wildcard: wildcard || false,
                setupRenew: renew !== false,
            });
            console.log('✅ 证书申请成功');
            console.log(`涵盖域名: ${result.domains.join(', ')}`);
            console.log(`证书路径: ${result.certPath}`);
            console.log(`私钥路径: ${result.keyPath}`);
            if (result.renewTaskConfigured) {
                console.log('📅 自动续期任务已配置 (每天 03:00)');
            }
        } catch (err) {
            console.error('❌ 失败:', err.message);
            process.exit(1);
        }
    });

// migrate 子命令：从旧版 lego (v4) 迁移到 v5
program
    .command('migrate')
    .description('从旧版本 lego 工作目录迁移到新版')
    .option('--old-path <path>', '旧版 lego 路径 (默认 ~/.lego)')
    .option('--new-path <path>', '新版 lego 路径 (默认 ~/.dns-auto-ssl/certs/lego)')
    .action(async (options) => {
        const oldPath = options.oldPath || path.join(os.homedir(), '.lego');
        const newPath = options.newPath || path.join(os.homedir(), '.dns-auto-ssl', 'certs', 'lego');
        if (!fs.existsSync(oldPath)) {
            console.error(`错误: 旧路径不存在: ${oldPath}`);
            process.exit(1);
        }
        console.log(`正在从 ${oldPath} 迁移到 ${newPath} ...`);
        try {
            await runLego(['migrate', '--old-path', oldPath, '--new-path', newPath], {});
            console.log('✅ 迁移完成');
        } catch (err) {
            console.error('迁移失败:', err.message);
            process.exit(1);
        }
    });

program.parse();