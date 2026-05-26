import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

function getLegoBinDir() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const packageRoot = path.resolve(__dirname, '..');
    return path.join(packageRoot, 'bin');
}

export function getLegoPath() {
    const platform = os.platform();
    const legoFileName = platform === 'win32' ? 'lego.exe' : 'lego';
    return path.join(getLegoBinDir(), legoFileName);
}

function ensureLegoExists() {
    const legoPath = getLegoPath();
    if (!fs.existsSync(legoPath)) {
        throw new Error(
            `lego 未找到，请确保 postinstall 脚本已正确执行。\n期望路径: ${legoPath}`
        );
    }
    return legoPath;
}

export async function runLego(args, env = {}) {
    const legoPath = ensureLegoExists();
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