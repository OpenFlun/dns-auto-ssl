#!/usr/bin/env node
/**
 * @file renew-task.js
 * @description 独立安装续期任务（计划任务 / crontab）
 * 用法：node renew-task.js <参数JSON文件路径>
 * 需要管理员/root权限运行（由调用方提权执行）
 */
import { getLegoPath } from './lego.js';
import { acmeDirectory, execPromise, path, fs, isWindows, dnsAutoSslHome } from './shard.js';

// ---------- 读取参数 ----------
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

// 构建续期命令
let renewCmd = `"${legoBin}" run --accept-tos`;
if (staging) renewCmd += ` --server "${acmeDirectory}"`;

renewCmd += ` --email "${email}" --domains "${domainsStr}" --dns "${dnsProvider}" --path "${certPath}"`;

// ---------- Windows 计划任务 ----------
const installWindowsTask = async () => {
    const taskName = mainDomain;
    fs.mkdirSync(dnsAutoSslHome, { recursive: true });

    // 批处理文件：${mainDomain}.bat
    const batFile = path.join(dnsAutoSslHome, `${taskName}.bat`),
        envSet = Object.entries(apiEnv).map(([k, v]) => `set ${k}=${v}`).join('\r\n'),
        batContent = `@echo off\n${envSet}\n${renewCmd}\nexit\n`;

    fs.writeFileSync(batFile, batContent, 'utf8');
    // 删除旧任务（若存在同名任务）
    try {
        await execPromise(`powershell -Command "Unregister-ScheduledTask -TaskName '${taskName}' -Confirm:\$false -ErrorAction SilentlyContinue"`);
    } catch (e) { }

    // 创建新任务，PowerShell 脚本命名为 ${mainDomain}.ps1
    const psScript = `
        $action = New-ScheduledTaskAction -Execute "${batFile}"
        $triggerDaily = New-ScheduledTaskTrigger -Daily -At "03:00"
        $triggerAtLogOn = New-ScheduledTaskTrigger -AtLogOn
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
        Register-ScheduledTask -TaskName "${taskName}" -Action $action -Trigger @($triggerDaily, $triggerAtLogOn) -Principal $principal -Settings $settings -Force | Out-Null
        Write-Output "SUCCESS"
     `.trim(), ps1File = path.join(dnsAutoSslHome, `${taskName}.ps1`);

    fs.writeFileSync(ps1File, psScript, 'utf8');
    try {
        const { stdout } = await execPromise(`powershell -ExecutionPolicy Bypass -File "${ps1File}"`);
        if (stdout.includes('SUCCESS')) console.log(`✅ Windows 计划任务 "${taskName}" 创建成功（每天03:00 + 登录时触发）`);
        else throw new Error('注册失败：' + stdout);
    } finally {
        fs.unlinkSync(ps1File);
    }
},

    // ---------- Linux / macOS crontab ----------
    installCronJob = async () => {
        fs.mkdirSync(dnsAutoSslHome, { recursive: true });

        // 续期脚本：${mainDomain}.sh;日志文件：${mainDomain}.log
        const scriptPath = path.join(dnsAutoSslHome, `${mainDomain}.sh`), logFile = path.join(dnsAutoSslHome, `${mainDomain}.log`),
            envExports = Object.entries(apiEnv).map(([k, v]) => `export ${k}="${v}"`).join('\n'),
            scriptContent = `#!/bin/sh\n${envExports}\n${renewCmd}\n`;

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
        console.log(`✅ crontab 任务已添加，脚本：${scriptPath}，日志：${logFile}`);
    };

// ---------- 执行安装 ----------
(async () => {
    try {
        isWindows ? await installWindowsTask() : await installCronJob();
        console.log('🎉 自动续期任务安装成功！');
        process.exit(0);
    } catch (err) {
        console.error('❌ 安装失败:', err.message);
        process.exit(1);
    }
})();