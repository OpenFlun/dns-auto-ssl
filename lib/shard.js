/**
 * 共享模块,导出在多个文件中使用的常用函数和模块
 * >查看定义:@see {@link exec}、{@link spawn}、{@link path}、{@link fs}、{@link platform}}
 */
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { platform, homedir, tmpdir } from 'os';
import { fileURLToPath } from 'url';

/**
 * 将 child_process.exec 包装成 Promise
 * >查看定义:@see {@link execPromise}
 */
const execPromise = promisify(exec);

/**
 * 证书配置默认目录(用户主目录下 .dns-auto-ssl 目录中,包含自动续期相关的文件和目录)
 * >查看定义:@see {@link dnsAutoSslDir}
 */
const dnsAutoSslDir = '.dns-auto-ssl';

/**
 * ACME 服务器的目录 URL
 * >查看定义:@see {@link acmeDirectory}
 * @type {string}
 */
const acmeDirectory = 'https://acme-staging-v02.api.letsencrypt.org/directory';
/**
 * 获取当前模块所在目录的路径（类似 CommonJS 的 __dirname）
 * >查看定义:@see {@link getDirname}
 * @param {string} metaUrl - 传入 `import.meta.url`
 * @returns {string} 当前模块的目录路径
 */
const getDirname = metaUrl => path.dirname(fileURLToPath(metaUrl));

/**
 * 判断当前平台是否为 Windows
 * >查看定义:@see {@link isWindows}
 * @type {boolean}
 */
const isWindows = platform() === 'win32';

/**
 * 获取 dns-auto-ssl 的主目录路径
 * >查看定义:@see {@link dnsAutoSslHome}
 * @type {string}
 */
const dnsAutoSslHome = path.join(homedir(), dnsAutoSslDir);

/**
 * 获取系统临时目录路径
 * >查看定义:@see {@link tmpDir}
 * @type {string}
 */
const tmpDir = tmpdir();

export { dnsAutoSslDir, acmeDirectory, execPromise, spawn, path, fs, getDirname, platform, isWindows, dnsAutoSslHome, tmpDir };