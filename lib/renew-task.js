#!/usr/bin/env node
import { getLegoPath } from './lego.js';
import { acmeDirectory, execPromise, path, fs, isWindows, dnsAutoSslHome, getRenewStampPath } from './shard.js';

// 读取参数...
const paramFilePath = process.argv[2];
if (!paramFilePath) {
    console.error('用法: node renew-task.js <参数文件>');
    process.exit(1);
}
let params;
try {
    const content = fs.readFileSync(paramFilePath, 'utf8');
    params = JSON.parse(content);
} catch (err) {
    console.error('读取参数失败:', err.message);
    process.exit(1);
}

const { email, domains, mainDomain, dnsProvider, apiEnv, certPath, staging } = params,
    domainsStr = domains.join(','), legoBin = getLegoPath();

let renewCmd = `"${legoBin}" run --accept-tos`;
if (staging) renewCmd += ` --server "${acmeDirectory}"`;
renewCmd += ` --email "${email}" --domains "${domainsStr}" --dns "${dnsProvider}" --path "${certPath}"`;

const stampPath = getRenewStampPath(mainDomain),
    // ---------- Windows 安装 ----------
    installWindowsTask = async () => {
        const taskName = mainDomain;
        fs.mkdirSync(dnsAutoSslHome, { recursive: true });

        const batFile = path.join(dnsAutoSslHome, `${taskName}.bat`),
            envSet = Object.entries(apiEnv).map(([k, v]) => `set ${k}=${v}`).join('\r\n'),
            updateStampCmd = `powershell -Command "$expiry = [int64]((Get-Date).ToUniversalTime() - (Get-Date '1970-01-01')).TotalSeconds + 86400; [System.IO.File]::WriteAllText('${stampPath.replace(/\\/g, '\\\\')}', $expiry.ToString())"`,
            batContent = `@echo off\n${envSet}\n${renewCmd}\n${updateStampCmd}\nexit\n`;

        fs.writeFileSync(batFile, batContent, 'utf8');

        // 删除旧任务
        try {
            await execPromise(`powershell -Command "Unregister-ScheduledTask -TaskName '${taskName}' -Confirm:\$false -ErrorAction SilentlyContinue"`);
        } catch (e) { }

        // 创建新任务
        const psScript = `
        $action = New-ScheduledTaskAction -Execute "${batFile}"
        $triggerDaily = New-ScheduledTaskTrigger -Daily -At "03:00"
        $triggerAtLogOn = New-ScheduledTaskTrigger -AtLogOn
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
        Register-ScheduledTask -TaskName "${taskName}" -Action $action -Trigger @($triggerDaily, $triggerAtLogOn) -Principal $principal -Settings $settings -Force | Out-Null
        Write-Output "SUCCESS"
    `.trim(),
            ps1File = path.join(dnsAutoSslHome, `${taskName}.ps1`);

        fs.writeFileSync(ps1File, psScript, 'utf8');
        try {
            const { stdout } = await execPromise(`powershell -ExecutionPolicy Bypass -File "${ps1File}"`);
            if (!stdout.includes('SUCCESS')) throw new Error('注册失败：' + stdout);
            console.log(`✅ Windows 计划任务(自动续期): "${taskName}" 创建成功`);
            await execPromise(`"${batFile}"`);
        } finally {
            fs.unlinkSync(ps1File);
        }
    };

// ---------- Linux / macOS 安装 ----------
const installCronJob = async () => {
    fs.mkdirSync(dnsAutoSslHome, { recursive: true });

    const scriptPath = path.join(dnsAutoSslHome, `${mainDomain}.sh`),
        logFile = path.join(dnsAutoSslHome, `${mainDomain}.log`),
        envExports = Object.entries(apiEnv).map(([k, v]) => `export ${k}="${v}"`).join('\n'),
        scriptContent = `#!/bin/sh\n${envExports}\n${renewCmd}\nexpiry=$(($(date +%s) + 86400))\necho "$expiry" > "${stampPath}"\n`;

    fs.writeFileSync(scriptPath, scriptContent, 'utf8');
    fs.chmodSync(scriptPath, 0o755);

    const cronCmd = `0 3 * * * ${scriptPath} >> ${logFile} 2>&1`;
    let current = '';
    try {
        const { stdout } = await execPromise('crontab -l');
        current = stdout;
    } catch (err) {
        if (err.code !== 1) throw err;
    }
    if (current.includes(scriptPath)) return;

    const newCron = current ? `${current}\n${cronCmd}` : cronCmd;
    await execPromise('crontab -', { input: newCron });
    console.log(`✅ crontab 任务已添加,自动续期脚本：${scriptPath}，日志：${logFile}`);
    await execPromise(scriptPath);
};

// 执行安装
(async () => {
    try {
        isWindows ? await installWindowsTask() : await installCronJob();
        process.exit(0);
    } catch (err) {
        console.error('❌ 安装失败:', err.message);
        process.exit(1);
    }
})();