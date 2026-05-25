import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { getLegoPath } from './lego.js';

async function setupRenewTask({ email, domains, dnsProvider, apiEnv, certPath }) {
    const platform = os.platform();
    const legoBin = getLegoPath();
    const domainsStr = domains.join(',');

    // 构建 renew 命令的基本部分 (不包含环境变量)
    const renewCmd = `"${legoBin}" --email "${email}" --domains "${domainsStr}" --dns "${dnsProvider}" --path "${certPath}" renew --days 30`;

    if (platform === 'win32') {
        await setupWindowsTask(renewCmd, apiEnv);
    } else {
        await setupCronJob(renewCmd, apiEnv);
    }
    console.log('✅ 自动续期任务已配置');
}

async function setupCronJob(command, apiEnv) {
    // 生成环境变量前缀，例如 "ALICLOUD_ACCESS_KEY=xxx ALICLOUD_SECRET_KEY=yyy"
    const envPrefix = Object.entries(apiEnv)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
    const fullCommand = `${envPrefix} ${command} >> ${os.homedir()}/.dns-auto-ssl/renew.log 2>&1`;
    const cronLine = `0 3 * * * ${fullCommand}`;

    // 获取当前 crontab
    const { exec } = await import('node:child_process');
    const getCrontab = () => new Promise((resolve, reject) => {
        exec('crontab -l', (err, stdout, stderr) => {
            if (err && err.code === 1) resolve(''); // 空 crontab
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
    // 将环境变量嵌入到 PowerShell 命令中
    const envAssignments = Object.entries(apiEnv)
        .map(([k, v]) => `$env:${k}='${v}'`)
        .join('; ');
    const fullPsCommand = `${envAssignments}; ${command}`;
    // 转义双引号
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