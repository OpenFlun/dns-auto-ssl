#!/usr/bin/env node

import { Command } from 'commander';
import { setup } from '../index.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const program = new Command();

program
    .name('dns-auto-ssl')
    .description('自动通过 DNS API 申请 Let\'s Encrypt SSL 证书，支持通配符和自动续期')
    .option('-e, --email <email>', '邮箱地址 (必填)')
    .option('-d, --domains <domains>', '域名，多个用逗号分隔 (必填)')
    .option('-p, --provider <provider>', 'DNS 服务商代码 (如 alidns, dnspod, cloudflare, route53 等，与 lego 官方代码保持一致)', (value) => value.toLowerCase())
    .option('--env <env...>', '为 DNS 插件设置环境变量，格式为 KEY=value，可重复使用', (value, previous) => {
        // 用于存储环境变量的数组
        const envArray = previous || [];
        envArray.push(value);
        return envArray;
    })
    .option('--cert-path <path>', '证书存储路径 (默认: ~/.dns-auto-ssl/certs/lego)')
    .option('--wildcard', '自动为裸域添加通配符支持')
    .option('--no-renew', '不配置自动续期任务')
    .action(async (options) => {
        const { email, domains, provider, certPath, wildcard, renew, env } = options;
        if (!email || !domains || !provider) {
            console.error('❌ 错误: --email, --domains, --provider 为必填参数');
            process.exit(1);
        }

        // 组装 API 环境变量
        let apiEnv = {};
        if (env && env.length) {
            for (const item of env) {
                const [key, ...valueParts] = item.split('=');
                const value = valueParts.join('=');
                if (key && value) {
                    apiEnv[key] = value;
                } else {
                    console.warn(`⚠️ 警告: 忽略无效的环境变量格式: ${item}`);
                }
            }
        }

        // 可选：为极少数知名提供商提供友好的缺省值提示
        if (provider === 'alidns' && !apiEnv.ALICLOUD_ACCESS_KEY) {
            console.warn('⚠️ 警告: 阿里云 DNS 通常需要设置 ALICLOUD_ACCESS_KEY 和 ALICLOUD_SECRET_KEY 环境变量。');
        }
        if (provider === 'dnspod' && !apiEnv.TENCENTCLOUD_SECRET_ID) {
            console.warn('⚠️ 警告: 腾讯云 DNS (DNSPod) 通常需要设置 TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY 环境变量。');
        }
        if (provider === 'cloudflare' && !apiEnv.CF_API_TOKEN) {
            console.warn('⚠️ 警告: Cloudflare DNS 通常需要设置 CF_API_TOKEN 环境变量。');
        }

        if (Object.keys(apiEnv).length === 0) {
            console.warn('⚠️ 警告: 没有提供任何环境变量，请确保你的 DNS 提供商所需的凭证已通过 --env 参数传递。');
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
            console.log('\n✅ 证书申请成功!');
            console.log(`涵盖域名: ${result.domains.join(', ')}`);
            console.log(`证书路径: ${result.certPath}`);
            console.log(`私钥路径: ${result.keyPath}`);
            if (result.renewTaskConfigured) {
                console.log('📅 自动续期任务已配置 (每天凌晨 03:00)');
            }
        } catch (err) {
            console.error('\n❌ 失败:', err.message);
            process.exit(1);
        }
    });

program.parse();