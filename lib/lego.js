import { spawn, path, fs, getDirname, platform, isWindows, dnsAutoSslHome } from './shard.js';

const legoFileName = isWindows ? 'lego.exe' : 'lego',
    getPackageRoot = () => {
        const __dirname = getDirname(import.meta.url);
        return path.resolve(__dirname, '..');
    },

    getPlatformDir = () => {
        if (isWindows) return 'win32';
        if (platform() === 'linux') return 'linux';
        if (platform() === 'darwin') return 'darwin';
        throw new Error(`不支持的操作系统: ${platform()}`);
    },

    // 用户目录下的 lego 可执行文件路径
    getUserLegoPath = () => {
        return path.join(dnsAutoSslHome, legoFileName);
    },

    // 从包内预编译目录复制 lego 到用户目录
    ensureLegoInUserDir = () => {
        const targetPath = getUserLegoPath();
        if (fs.existsSync(targetPath)) return targetPath;

        // 源文件路径
        const platformDir = getPlatformDir(), sourcePath = path.join(getPackageRoot(), 'prebuilt', platformDir, legoFileName);

        if (!fs.existsSync(sourcePath))
            throw new Error(
                `预编译的 lego 未找到，请确保 prebuilt/${platformDir}/ 目录下存在 ${legoFileName}\n期望路径: ${sourcePath}`
            );

        fs.mkdirSync(dnsAutoSslHome, { recursive: true }); // 创建用户目录
        fs.copyFileSync(sourcePath, targetPath);           // 复制文件

        if (!isWindows) fs.chmodSync(targetPath, 0o755);   // 非 Windows 系统设置可执行权限
        console.log(`📦 lego 已复制到用户目录: ${targetPath}`);
        return targetPath;
    };

/**
 * 对外暴露：获取 lego 的路径（确保已复制到用户目录）
 * >查看定义:@see {@link getLegoPath}
 * @returns {string} lego 可执行文件的路径
 */
const getLegoPath = () => {
    return ensureLegoInUserDir();
}

/**
 * 执行 lego 命令,列出服务器上正在运行的进程
 * >查看定义:@see {@link runLego}
 * @param {string[]} args - lego 命令行参数
 * @param {Object} env - 环境变量
 * @returns {Promise<void>} 执行结果的 Promise
 */
const runLego = async (args, env = {}) => {
    const legoPath = getLegoPath();
    return new Promise((resolve, reject) => {
        const proc = spawn(legoPath, args, { env: { ...process.env, ...env }, stdio: 'inherit' });
        proc.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`lego 执行失败，退出码 ${code}`));
        });
        proc.on('error', reject);
    });
}

export { getLegoPath, runLego };