#!/usr/bin/env node
import { Command } from 'commander';
import { dnsAutoSslDir } from '../lib/shard.js';
import { setup } from '../index.js';

/**
 * 申请证书并按需安装自动续期任务,选项与主入口 setup 参数一一对应;
 * >查看定义:@see {@link runSetup}
 * @param {object} options 命令行选项
 * @returns {Promise<void>} 完成后退出
 */
const runSetup = async options => {
  const { email, domains, provider, certPath, wildcard, renew, env, staging, pfxPassword } = options;
  if (!email || !domains || !provider) {
    console.error('❌ 错误: --email, --domains, --provider 为必填参数');
    process.exit(1);
  }

  let apiEnv = {};
  if (env?.length) {
    for (const item of env) {
      const [key, ...valueParts] = item.split('='), value = valueParts.join('=');
      if (key && value) apiEnv[key] = value;
      else console.warn(`⚠️ 警告: 忽略无效的环境变量格式: ${item}`);
    }
  }

  if (provider === 'alidns' && !apiEnv.ALICLOUD_ACCESS_KEY)
    console.warn('⚠️ 警告: 阿里云 DNS 通常需要设置 ALICLOUD_ACCESS_KEY 和 ALICLOUD_SECRET_KEY 环境变量;');
  if (provider === 'dnspod' && !apiEnv.TENCENTCLOUD_SECRET_ID)
    console.warn('⚠️ 警告: 腾讯云 DNS (DNSPod) 通常需要设置 TENCENTCLOUD_SECRET_ID ' +
      '和 TENCENTCLOUD_SECRET_KEY 环境变量;');
  if (provider === 'cloudflare' && !apiEnv.CF_API_TOKEN)
    console.warn('⚠️ 警告: Cloudflare DNS 通常需要设置 CF_API_TOKEN 环境变量;');
  if (Object.keys(apiEnv).length === 0)
    console.warn('⚠️ 警告: 没有提供任何环境变量,请确保 DNS 提供商所需凭证已通过 --env 传递;');

  try {
    const result = await setup({
      email, domains: domains.split(','), dnsProvider: provider,
      apiEnv, certPath, pfxPassword,
      staging: staging || false,
      wildcard: wildcard || false,
      setupRenew: renew !== false
    });
    console.log('\n✅ 证书申请成功!');
    console.log(`涵盖域名: ${result.domains.join(', ')}`);
    console.log(`证书路径: ${result.certPath}`);
    console.log(`私钥路径: ${result.keyPath}`);
    if (result.renewTaskConfigured) console.log('📅 自动续期任务已配置 (每天凌晨 03:00)');
  } catch (err) {
    console.error('\n❌ 失败:', err.message);
    process.exit(1);
  }
};

/**
 * 输出命令用法与 setup 选项;
 * >查看定义:@see {@link printHelp}
 */
const printHelp = () => {
  console.log('用法: dns-auto-ssl <命令> [选项]');
  console.log('  setup              申请证书并按需安装自动续期任务');
  console.log('');
  console.log('setup 选项:');
  console.log('  -e, --email <email>        邮箱地址 (必填)');
  console.log('  -d, --domains <domains>    域名,多个用逗号分隔 (必填)');
  console.log('  -p, --provider <provider>  DNS 服务商代码 (如 alidns, dnspod, cloudflare, route53 等)');
  console.log('  --env <env...>             为 DNS 插件设置环境变量,格式为 KEY=value,可重复使用');
  console.log(`  --cert-path <path>         证书存储路径 (默认: ~/${dnsAutoSslDir}/certs/lego)`);
  console.log('  --pfx-password <password>  PFX 私钥密码 (默认: iisPass789)');
  console.log('  --wildcard                 自动为裸域添加通配符支持');
  console.log('  --no-renew                 不配置自动续期任务');
  console.log('  --staging                  使用 Let\'s Encrypt 测试环境 (acme-staging)');
};

/**
 * 命令行入口,子命令与主入口导出对齐;
 * >查看定义:@see {@link main}
 */
const main = () => {
  const program = new Command(), args = process.argv.slice(2);
  program.name('dns-auto-ssl')
    .description('自动通过 DNS API 申请 Let\'s Encrypt SSL 证书,支持通配符和自动续期')
    .helpOption(false)
    .exitOverride();

  program.command('setup')
    .description('申请证书并按需安装自动续期任务')
    .helpOption(false)
    .option('-e, --email <email>', '邮箱地址 (必填)')
    .option('-d, --domains <domains>', '域名,多个用逗号分隔 (必填)')
    .option('-p, --provider <provider>', 'DNS 服务商代码 (如 alidns, dnspod, cloudflare, route53 等)',
      v => v.toLowerCase())
    .option('--env <env...>', '为 DNS 插件设置环境变量,格式为 KEY=value,可重复使用', (v, prev) => {
      const arr = prev || []; arr.push(v); return arr;
    })
    .option('--cert-path <path>', `证书存储路径 (默认: ~/${dnsAutoSslDir}/certs/lego)`)
    .option('--pfx-password <password>', 'PFX 私钥密码 (默认: iisPass789)')
    .option('--wildcard', '自动为裸域添加通配符支持')
    .option('--no-renew', '不配置自动续期任务')
    .option('--staging', '使用 Let\'s Encrypt 测试环境 (acme-staging)')
    .action(runSetup);

  if (!args.length || args.includes('-h') || args.includes('--help') || args[0] === 'help')
    return printHelp(), process.exit(0);
  try {
    program.parse();
  } catch (err) {
    printHelp();
    process.exit(err.exitCode || 1);
  }
};

main();
export { runSetup, main };