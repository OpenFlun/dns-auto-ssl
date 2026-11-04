#!/usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import { dnsAutoSslDir } from '../lib/shard.js';
import { setup } from '../index.js';
import { copyFile } from '../copy-files.js';

// 输出命令用法与 setup 选项;
const printHelp = program => {
  const cmd = (name, desc) => `      ${chalk.cyanBright(name.padEnd(28))}${chalk.gray(desc)}`,
    grp = name => `    ${chalk.cyan(name)}`,
    fmt = o => {
      const m = o.flags.match(/<[^>]+>/), value = m ? ' ' + m[0] : '',
        display = o.short ? o.short + value : o.flags, full = o.short ? `;完整写法 ${o.long}` : '';
      return cmd(display, o.description + full);
    },
    lines = [`  ${chalk.blueBright('用法:')} dns-auto-ssl <命令> [选项]`, '', grp('命令')];
  for (const c of program.commands) lines.push(cmd(c.name(), c.description()));
  lines.push(cmd('help', '显示本帮助'), '');
  for (const c of program.commands) {
    if (!c.options.length) continue;
    lines.push(grp(`${c.name()} 选项`));
    for (const o of c.options) lines.push(fmt(o));
  }
  lines.push('', chalk.gray('申请前请确认 DNS 服务商凭证已通过 --env 传入;'));
  console.log(lines.join('\n'));
};
/**
 * 申请证书并按需安装自动续期任务,选项与主入口 setup 参数一一对应;
 * >查看定义:@see {@link runSetup}
 * @param {object} options 命令行选项
 * @returns {Promise<void>} 完成后退出
 */
const runSetup = async options => {
  const { email, domains, provider, certPath, wildcard, renew, env, staging, pfxPassword } = options;
  if (!email || !domains || !provider)
    console.error(chalk.red('✗ ') + '缺少必填参数: --email、--domains、--provider'), process.exit(1);

  let apiEnv = {};
  if (env?.length) {
    for (const item of env) {
      const [key, ...valueParts] = item.split('='), value = valueParts.join('=');
      if (key && value) apiEnv[key] = value;
      else console.warn(chalk.yellow('⚠ ') + `忽略无效的环境变量格式: ${item}`);
    }
  }

  if (provider === 'alidns' && !apiEnv.ALICLOUD_ACCESS_KEY)
    console.warn(chalk.yellow('⚠ ') + '阿里云 DNS 通常需要设置 ALICLOUD_ACCESS_KEY 和 ALICLOUD_SECRET_KEY 环境变量;');
  if (provider === 'dnspod' && !apiEnv.TENCENTCLOUD_SECRET_ID)
    console.warn(chalk.yellow('⚠ ') + '腾讯云 DNS (DNSPod) 通常需要设置 TENCENTCLOUD_SECRET_ID ' +
      '和 TENCENTCLOUD_SECRET_KEY 环境变量;');
  if (provider === 'cloudflare' && !apiEnv.CF_API_TOKEN)
    console.warn(chalk.yellow('⚠ ') + 'Cloudflare DNS 通常需要设置 CF_API_TOKEN 环境变量;');
  if (Object.keys(apiEnv).length === 0)
    console.warn(chalk.yellow('⚠ ') + '没有提供任何环境变量,请确保 DNS 提供商所需凭证已通过 --env 传递;');

  try {
    const result = await setup({
      email, domains: domains.split(','), dnsProvider: provider,
      apiEnv, certPath, pfxPassword,
      staging: staging || false,
      wildcard: wildcard || false,
      setupRenew: renew !== false
    });
    console.log(''), console.log(chalk.green('✓ ') + chalk.greenBright('证书申请成功'));
    console.log(chalk.gray('涵盖域名: ') + result.domains.join(', '));
    console.log(chalk.gray('证书路径: ') + result.certPath);
    console.log(chalk.gray('私钥路径: ') + result.keyPath);
    if (result.renewTaskConfigured) console.log(chalk.gray('自动续期: ') + '已配置,每天凌晨 03:00 执行');
  } catch (err) {
    console.error(chalk.red('✗ ') + '失败: ' + err.message), process.exit(1);
  }
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
    .option('-e, --email <email>', '邮箱地址,必填')
    .option('-d, --domains <domains>', '域名,多个用逗号分隔,必填')
    .option('-p, --provider <provider>', 'DNS 服务商代码,如 alidns、dnspod、cloudflare、route53',
      v => v.toLowerCase())
    .option('--env <env...>', '为 DNS 插件设置环境变量,格式 KEY=value,可重复', (v, prev) => {
      const arr = prev || []; arr.push(v); return arr;
    })
    .option('--cert-path <path>', `证书存储路径,默认 ~/${dnsAutoSslDir}/certs/lego`)
    .option('--pfx-password <password>', 'PFX 私钥密码,默认 iisPass789')
    .option('--wildcard', '自动为裸域添加通配符支持')
    .option('--no-renew', '不配置自动续期任务')
    .option('--staging', "使用 Let's Encrypt 测试环境,acme-staging")
    .action(runSetup);

  program.command('example')
    .description('生成 DnsAutoSSL.js 示例文件到项目根目录')
    .helpOption(false)
    .action(copyFile);

  if (!args.length || args.includes('-h') || args.includes('--help') || args[0] === 'help')
    return printHelp(program), process.exit(0);
  try { program.parse(); } catch (err) { printHelp(program), process.exit(err.exitCode || 1); }
};

main();
export { runSetup, main };