import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { getLegoPath } from './lego.js';

/**
 * 配置自动续期任务 (cron / Windows 计划任务)
 * @param {Object} options
 * @param {string} options.email
 * @param {string[]} options.domains
 * @param {string} options.dnsProvider
 * @param {Object} options.apiEnv - 环境变量对象
 * @param {string} options.certPath - lego 工作目录
 * @param {boolean} [options.staging=false] - 是否使用 staging 环境
 */
export async function setupRenewTask({ email, domains, dnsProvider, apiEnv, certPath, staging = false }) {
    const platform = os.platform();
    const legoBin = getLegoPath();
    const domainsStr = domains.join(',');

    // 构建续期命令 (v5: run 命令在前，选项在后)
    let renewCmd = `"${legoBin}" run --accept-tos`;
    if (staging) {
        renewCmd += ` --server "https://acme-staging-v02.api.letsencrypt.org/directory"`;
    }
    renewCmd += ` --email "${email}" --domains "${domainsStr}" --dns "${dnsProvider}" --path "${certPath}"`;

    if (platform === 'win32') {
        await setupWindowsTask(renewCmd, apiEnv);
    } else {
        await setupCronJob(renewCmd, apiEnv);
    }
    console.log('✅ 自动续期任务已配置 (每天 03:00)');
}

async function setupCronJob(command, apiEnv) {
    // 将环境变量拼接到命令前
    const envPrefix = Object.entries(apiEnv)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
    const logFile = path.join(os.homedir(), '.dns-auto-ssl', 'renew.log');
    const fullCommand = `${envPrefix} ${command} >> ${logFile} 2>&1`;
    const cronLine = `0 3 * * * ${fullCommand}`;

    const { exec } = await import('node:child_process');
    const getCrontab = () =>
        new Promise((resolve, reject) => {
            exec('crontab -l', (err, stdout) => {
                if (err && err.code === 1) resolve('');
                else if (err) reject(err);
                else resolve(stdout);
            });
        });

    let current = await getCrontab();
    if (!current.includes(command)) {
        const newCron = current ? `${current}\n${cronLine}` : cronLine;
        await new Promise((resolve, reject) => {
            const proc = spawn('crontab', ['-'], { stdio: ['pipe', 'inherit', 'inherit'] });
            proc.stdin.write(newCron);
            proc.stdin.end();
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`crontab 写入失败，退出码 ${code}`));
            });
        });
        console.log('已添加到 crontab');
    } else {
        console.log('续期任务已存在，跳过添加');
    }
}

async function setupWindowsTask(command, apiEnv) {
    // 将环境变量嵌入 PowerShell 命令
    const envAssignments = Object.entries(apiEnv)
        .map(([k, v]) => `$env:${k}='${v}'`)
        .join('; ');
    const fullPsCommand = `${envAssignments}; ${command}`;
    const escapedCommand = fullPsCommand.replace(/"/g, '`"');

    const psScript = `
        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command \\"${escapedCommand}\\""
        $trigger = New-ScheduledTaskTrigger -Daily -At "03:00"
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
        Register-ScheduledTask -TaskName "DNSAutoSSL-Renew" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
  `;
    const { exec } = await import('node:child_process');
    await new Promise((resolve, reject) => {
        exec(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

export { setupRenewTask };