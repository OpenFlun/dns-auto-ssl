import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { extract } from 'tar';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'node:url';

const LEGO_VERSION = 'v4.14.2';
const BASE_URL = `https://github.com/go-acme/lego/releases/download/${LEGO_VERSION}`;

// 镜像站列表（按推荐顺序排列）
const MIRRORS = [
    (url) => url,                                      // 官方源
    (url) => url.replace('https://github.com', 'https://ghproxy.net'),
    (url) => url.replace('https://github.com', 'https://gh-proxy.com'),
    (url) => url.replace('https://github.com', 'https://github.akams.cn'),
];

function getLegoBinDir() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const packageRoot = path.resolve(__dirname, '..');
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
    const originalUrl = `${BASE_URL}/${fileName}`;
    const tempFile = path.join(binDir, `lego.${ext}`);

    let lastError = null;

    for (const mirror of MIRRORS) {
        const url = mirror(originalUrl);
        console.log(`尝试从 ${url} 下载 ...`);

        try {
            await new Promise((resolve, reject) => {
                const fileStream = createWriteStream(tempFile);
                const request = https.get(url, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }
                    pipeline(response, fileStream)
                        .then(resolve)
                        .catch(reject);
                });

                request.on('error', reject);
                request.setTimeout(30000, () => {
                    request.destroy();
                    reject(new Error('下载超时'));
                });
            });

            console.log(`下载成功！`);
            break; // 成功则跳出镜像循环
        } catch (err) {
            console.warn(`从 ${url} 下载失败: ${err.message}`);
            lastError = err;
            // 继续尝试下一个镜像
        }
    }

    // 如果所有镜像都失败，抛出最后一个错误
    if (!fs.existsSync(tempFile)) {
        throw lastError || new Error('所有镜像站均下载失败');
    }

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