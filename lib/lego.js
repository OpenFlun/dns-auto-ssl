import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { extract } from 'tar';           // 仅用于 .tar.gz
import AdmZip from 'adm-zip';            // 用于 Windows .zip

const LEGO_VERSION = 'v4.14.2';
const BASE_URL = `https://github.com/go-acme/lego/releases/download/${LEGO_VERSION}`;

function getLegoBinDir() {
    const packageRoot = path.resolve(new URL(import.meta.url).pathname, '../../');
    return path.join(packageRoot, 'bin');
}

function getLegoPath() {
    const platform = os.platform();
    const legoFileName = platform === 'win32' ? 'lego.exe' : 'lego';
    return path.join(getLegoBinDir(), legoFileName);
}

async function downloadLego() {
    const binDir = getLegoBinDir();
    const legoPath = getLegoPath();
    if (fs.existsSync(legoPath)) {
        console.log('lego 已存在，跳过下载');
        return legoPath;
    }

    fs.mkdirSync(binDir, { recursive: true });

    const platform = os.platform();
    const arch = os.arch();
    let archName = arch === 'x64' ? 'amd64' : arch;
    let platformName = platform === 'win32' ? 'windows' : platform;
    const ext = platform === 'win32' ? 'zip' : 'tar.gz';
    const fileName = `lego_${LEGO_VERSION}_${platformName}_${archName}.${ext}`;
    const url = `${BASE_URL}/${fileName}`;

    console.log(`正在下载 lego 从 ${url} ...`);
    const tempFile = path.join(binDir, `lego.${ext}`);

    await new Promise((resolve, reject) => {
        const fileStream = createWriteStream(tempFile);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`下载失败，HTTP ${response.statusCode}`));
                return;
            }
            pipeline(response, fileStream)
                .then(resolve)
                .catch(reject);
        }).on('error', reject);
    });

    // 解压
    if (ext === 'zip') {
        const zip = new AdmZip(tempFile);
        zip.extractAllTo(binDir, true);
    } else {
        await extract({
            file: tempFile,
            cwd: binDir,
            strip: 1,
        });
    }

    fs.rmSync(tempFile);
    if (platform !== 'win32') {
        fs.chmodSync(legoPath, 0o755);
    }
    console.log(`lego 已安装到 ${legoPath}`);
    return legoPath;
}

async function runLego(args, env) {
    const legoPath = getLegoPath();
    if (!fs.existsSync(legoPath)) {
        await downloadLego();
    }
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

export { downloadLego, getLegoPath, runLego };