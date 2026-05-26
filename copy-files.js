#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname);

function getPlatformDir() {
    const platform = os.platform();
    if (platform === 'win32') return 'win32';
    if (platform === 'linux') return 'linux';
    if (platform === 'darwin') return 'darwin';
    throw new Error(`不支持的操作系统: ${platform}`);
}

function copyLego() {
    const platformDir = getPlatformDir();
    const sourceDir = path.join(packageRoot, 'prebuilt', platformDir);
    const targetDir = path.join(packageRoot, 'bin');
    const sourceFile = path.join(sourceDir, os.platform() === 'win32' ? 'lego.exe' : 'lego');
    const targetFile = path.join(targetDir, os.platform() === 'win32' ? 'lego.exe' : 'lego');

    if (!fs.existsSync(sourceFile)) {
        console.error(`错误: 预置文件不存在 ${sourceFile}`);
        console.error(`请确保已下载 lego v5.1.0 对应平台的二进制文件并放入 prebuilt/${platformDir}/ 目录`);
        process.exit(1);
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(sourceFile, targetFile);

    if (os.platform() !== 'win32') {
        fs.chmodSync(targetFile, 0o755);
    }

    console.log(`✅ lego 已安装到 ${targetFile}`);
}

try {
    copyLego();
} catch (err) {
    console.error('安装 lego 失败:', err.message);
    process.exit(1);
}