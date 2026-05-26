import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

function getPackageRoot() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.resolve(__dirname, '..');
}

function getPlatformDir() {
    const platform = os.platform();
    if (platform === 'win32') return 'win32';
    if (platform === 'linux') return 'linux';
    if (platform === 'darwin') return 'darwin';
    throw new Error(`不支持的操作系统: ${platform}`);
}

export function getLegoPath() {
    const platformDir = getPlatformDir();
    const legoFileName = os.platform() === 'win32' ? 'lego.exe' : 'lego';
    const legoPath = path.join(getPackageRoot(), 'prebuilt', platformDir, legoFileName);
    if (!fs.existsSync(legoPath)) {
        throw new Error(
            `lego 未找到，请确保 prebuilt/${platformDir}/ 目录下存在 ${legoFileName} 文件\n期望路径: ${legoPath}`
        );
    }
    return legoPath;
}

export async function runLego(args, env = {}) {
    const legoPath = getLegoPath();
    return new Promise((resolve, reject) => {
        const proc = spawn(legoPath, args, {
            env: { ...process.env, ...env },
            stdio: 'inherit',
        });
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`lego 执行失败，退出码 ${code}`));
        });
        proc.on('error', reject);
    });
}