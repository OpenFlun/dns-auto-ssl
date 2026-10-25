#!/usr/bin/env node
import { getLegoPath } from './lego.js';
import { acmeDirectory, execPromise, path, fs, isWindows, dnsAutoSslHome, getRenewStampPath } from './shard.js';

// 读取参数...
const paramFilePath = process.argv[2];
if (!paramFilePath) console.error('用法: node renew-task.js <参数文件>'), process.exit(1);

let params;
try {
    const content = fs.readFileSync(paramFilePath, 'utf8');
    params = JSON.parse(content);
} catch (err) {
    console.error('读取参数失败:', err.message), process.exit(1);
}

const {
    email, domains, mainDomain, dnsProvider, apiEnv, certPath, staging, pfxPassword = 'iisPass789', opensslCmd = 'openssl'
} = params, domainsStr = domains.join(','), legoBin = getLegoPath();

let renewCmd = `"${legoBin}" run --accept-tos --ari-disable --no-random-sleep`;
if (staging) renewCmd += ` --server "${acmeDirectory}"`;
renewCmd += ` --email "${email}" --domains "${domainsStr}" --dns "${dnsProvider}" --path "${certPath}"`;

const stampPath = getRenewStampPath(mainDomain), logPath = path.join(dnsAutoSslHome, `${mainDomain}.renew.log`),
    certFile = path.join(certPath, 'certificates', `${mainDomain}.crt`),
    keyFile = path.join(certPath, 'certificates', `${mainDomain}.key`),
    pfxFile = path.join(certPath, 'certificates', `${mainDomain}.pfx`),
    // ---------- Windows 安装 ----------
    installWindowsTask = async () => {
        const taskName = mainDomain;
        fs.mkdirSync(dnsAutoSslHome, { recursive: true });

        const batFile = path.join(dnsAutoSslHome, `${taskName}.bat`),
            envSet = Object.entries(apiEnv).map(([k, v]) => `set ${k}=${v}`).join('\r\n'),
            updateStampCmd = `powershell -NoProfile -Command "$expiry = ` +
                `[int64]((Get-Date).ToUniversalTime() - (Get-Date '1970-01-01')).TotalSeconds + 86400; ` +
                `[System.IO.File]::WriteAllText('${stampPath.replace(/\\/g, '\\\\')}', $expiry.ToString())"`,
            // 完整 bat:续期 + 退出码检查 + 指纹比对 + PFX 生成 + 时间戳
            batContent = `@echo off
                setlocal enabledelayedexpansion
                ${envSet}

                set "CRT_FILE=${certFile}"
                set "KEY_FILE=${keyFile}"
                set "PFX_FILE=${pfxFile}"
                set "LOG_FILE=${logPath}"
                set "OPENSSL_CMD=${opensslCmd}"
                set "PFX_PASSWORD=${pfxPassword}"

                set "OLD_HASH="
                if exist "%CRT_FILE%" (
                    for /f "delims=" %%i in ('certutil -hashfile "%CRT_FILE%" SHA256 ^| findstr /v ":"') ` +
                    `do set "OLD_HASH=%%i"
                )

                if not exist "%CRT_FILE%" del /q "${certPath}\\certificates\\${mainDomain}.json" 2>nul

                ${renewCmd} >> "%LOG_FILE%" 2>&1

                if errorlevel 1 (
                    echo [%date% %time%] lego 续期失败,退出码 %errorlevel%,不更新时间戳 >> "%LOG_FILE%"
                    exit /b 1
                )

                set "NEW_HASH="
                if not exist "%CRT_FILE%" goto :STAMP
                for /f "delims=" %%i in ('certutil -hashfile "%CRT_FILE%" SHA256 ^| findstr /v ":"') do set "NEW_HASH=%%i"

                :: ============================================================
                :: 证书更新后自动静默生成 Windows 专用 PFX
                :: ============================================================
                if not "!OLD_HASH!"=="!NEW_HASH!" (
                    if exist "%OPENSSL_CMD%" (
                        "%OPENSSL_CMD%" pkcs12 -export -out "%PFX_FILE%" -inkey "%KEY_FILE%" ` +
                        `-in "%CRT_FILE%" -passout pass:%PFX_PASSWORD% >> "%LOG_FILE%" 2>&1
                        if errorlevel 1 (
                            echo [%date% %time%] PFX 生成失败 >> "%LOG_FILE%"
                        ) else (
                            echo [%date% %time%] PFX 已生成: %PFX_FILE% >> "%LOG_FILE%"
                        )
                    ) else (
                        where "%OPENSSL_CMD%" >nul 2>&1
                        if errorlevel 1 (
                            echo [%date% %time%] openssl not found, skip PFX >> "%LOG_FILE%"
                        ) else (
                            "%OPENSSL_CMD%" pkcs12 -export -out "%PFX_FILE%" -inkey "%KEY_FILE%" ` +
                            `-in "%CRT_FILE%" -passout pass:%PFX_PASSWORD% >> "%LOG_FILE%" 2>&1
                            if errorlevel 1 (
                                echo [%date% %time%] PFX 生成失败 >> "%LOG_FILE%"
                            ) else (
                                echo [%date% %time%] PFX 已生成: %PFX_FILE% >> "%LOG_FILE%"
                            )
                        )
                    )
                )

                :STAMP
                ${updateStampCmd}
                exit /b 0
            `;

        // Windows bat 必须用 CRLF,否则 cmd 解析中文/多字节字符时会错位
        fs.writeFileSync(batFile, batContent.replace(/^[ \t]+/gm, '').replace(/\r?\n/g, '\r\n'), 'utf8');
        // 删除旧任务
        try {
            await execPromise(`powershell -Command "Unregister-ScheduledTask -TaskName '${taskName}' ` +
            `-Confirm:\$false -ErrorAction SilentlyContinue"`);
        } catch (e) { }

        // 创建新任务(当前用户 + S4U + Highest)
        const psScript = `
            $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
            $action = New-ScheduledTaskAction -Execute "${batFile}"
            $triggerDaily = New-ScheduledTaskTrigger -Daily -At "03:00"
            $triggerAtLogOn = New-ScheduledTaskTrigger -AtLogOn
            $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType S4U -RunLevel Highest
            $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries ` +
            `-StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
            Register-ScheduledTask -TaskName "${taskName}" -Action $action ` +
            `-Trigger @($triggerDaily, $triggerAtLogOn) -Principal $principal -Settings $settings -Force | Out-Null
            Write-Output "SUCCESS"
        `.trim(), ps1File = path.join(dnsAutoSslHome, `${taskName}.ps1`);

        fs.writeFileSync(ps1File, psScript, 'utf8');
        try {
            const { stdout } = await execPromise(`powershell -ExecutionPolicy Bypass -File "${ps1File}"`);
            if (!stdout.includes('SUCCESS')) throw new Error('注册失败:' + stdout);
            console.log(`✅ Windows 计划任务(自动续期): "${taskName}" 创建成功`);
            await execPromise(`"${batFile}"`);
        } finally { fs.unlinkSync(ps1File) }
    },
    // ---------- Linux / macOS 安装 ----------
    installCronJob = async () => {
        fs.mkdirSync(dnsAutoSslHome, { recursive: true });

        const scriptPath = path.join(dnsAutoSslHome, `${mainDomain}.sh`),
            logFile = logPath, envExports = Object.entries(apiEnv).map(([k, v]) => `export ${k}="${v}"`).join('\n'),
            // 跨平台 hash:优先 sha256sum,回退 shasum
            hashFunc = `hash_file() {
                if command -v sha256sum >/dev/null 2>&1; then
                sha256sum "$1" | awk '{print $1}'
                else
                shasum -a 256 "$1" | awk '{print $1}'
                fi
            }`,
            // 完整 sh:续期 + 退出码检查 + 指纹比对 + 时间戳
            scriptContent = `#!/bin/sh
                ${envExports}

                CRT_FILE="${certFile}"
                LOG_FILE="${logFile}"

                ${hashFunc}

                OLD_HASH=""
                [ -f "$CRT_FILE" ] && OLD_HASH=$(hash_file "$CRT_FILE")

                [ ! -f "$CRT_FILE" ] && rm -f "${certPath}/certificates/${mainDomain}.json"

                ${renewCmd} >> "$LOG_FILE" 2>&1
                RC=$?
                if [ $RC -ne 0 ]; then
                  echo "[$(date)] lego 续期失败,退出码 $RC,不更新时间戳" >> "$LOG_FILE"
                  exit $RC
                fi

                NEW_HASH=""
                [ -f "$CRT_FILE" ] && NEW_HASH=$(hash_file "$CRT_FILE")

                # ============================================================
                # 证书更新后的部署逻辑(在包源码 renew-task.js 中扩展)
                # 指纹变化才执行,避免每次续期都动服务
                #
                # if [ "$OLD_HASH" != "$NEW_HASH" ]; then
                #   systemctl reload nginx >> "$LOG_FILE" 2>&1
                # fi
                # ============================================================

                expiry=$(($(date +%s) + 86400))
                echo "$expiry" > "${stampPath}"
            `;

        // sh 保持 LF 换行(Unix 系统默认)
        fs.writeFileSync(scriptPath, scriptContent.replace(/^[ \t]+/gm, ''), 'utf8'), fs.chmodSync(scriptPath, 0o755);

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
        console.log(`✅ crontab 任务已添加,自动续期脚本:${scriptPath},日志:${logFile}`);
        await execPromise(scriptPath);
    };

// 执行安装
(async () => {
    try {
        isWindows ? await installWindowsTask() : await installCronJob(), process.exit(0);
    } catch (err) {
        console.error('❌ 安装失败:', err.message), process.exit(1);
    }
})();