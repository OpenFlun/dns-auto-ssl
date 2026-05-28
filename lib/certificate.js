import { runLego, getLegoPath } from './lego.js';
import { acmeDirectory, execPromise, path, fs, getDirname, isWindows, dnsAutoSslHome, tmpDir } from './shard.js';

// 默认证书存放路径（用户目录下的 .dns-auto-ssl/certs
const getDefaultCertPath = () => {
    return path.join(dnsAutoSslHome, 'certs');
},

    // 获取续期任务脚本路径
    getTaskScriptPath = mainDomain => {
        const scriptName = isWindows ? `${mainDomain}.bat` : `${mainDomain}.sh`;
        return path.join(dnsAutoSslHome, scriptName);
    },

    // 检查续期任务是否已安装（通过检查续期脚本文件是否存在）
    isRenewTaskInstalled = async mainDomain => {
        return fs.existsSync(getTaskScriptPath(mainDomain));
    },

    // 检测 Windows 上是否可用 sudo
    isSudoAvailableOnWindows = async () => {
        if (!isWindows) return false;
        try {
            await execPromise('sudo --version', { shell: true });
            return true;
        } catch { return false }
    },

    // 运行需要提权的安装脚本
    runPrivilegedInstaller = async (params, mainDomain) => {
        const __dirname = getDirname(import.meta.url), installerScript = path.join(__dirname, 'renew-task.js'),
            paramsJson = JSON.stringify(params), tempFile = path.join(tmpDir, `${mainDomain}-${Date.now()}.json`);

        fs.writeFileSync(tempFile, paramsJson, 'utf8');
        let command = `sudo node "${installerScript}" "${tempFile}"`;
        if (isWindows) {
            const sudoAvailable = await isSudoAvailableOnWindows();
            if (!sudoAvailable) command = `powershell -Command "Start-Process -Verb RunAs -WindowStyle Hidden -Wait -FilePath 'node' -ArgumentList '\\"${installerScript}\\" \\"${tempFile}\\"'"`;
        }
        else console.log('🔐 需要管理员权限来安装自动续期任务，请在终端中输入密码...');

        try {
            const { stdout, stderr } = await execPromise(command);
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
        } catch (error) {
            console.error('❌ 安装续期任务失败:', error.message);
            throw error;
        } finally {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }
    };

/**
 * 证书申请 + 自动续期任务安装
 * >查看定义:@see {@link setup}
 * @param {Object} options - 配置选项
 * @param {string} options.email - 注册邮箱
 * @param {string|string[]} options.domains - 需要申请证书的域名，支持字符串或字符串数组
 * @param {string} options.dnsProvider - DNS 服务商标识（如 'alidns'）
 * @param {Object} options.apiEnv - DNS 服务商 API 访问所需的环境变量对象
 * @param {string} [options.certPath] - 证书存放路径,(可选,默认为用户目录下的 .dns-auto-ssl/certs)
 * @param {boolean} [options.wildcard=false] - 是否自动添加通配符域名(可选,默认 false)
 * @param {boolean} [options.setupRenew=true] - 是否安装自动续期任务(可选,默认 true)
 * @param {boolean} [options.staging=false] - 是否使用 Let's Encrypt 的测试环境（默认 false）
 * @returns {Promise<Object>} 包含 domains、certPath、keyPath 和 renewTaskConfigured 的对象
 */
const setup = async options => {
    const {
        email, domains: rawDomains, dnsProvider, apiEnv, certPath: userCertPath,
        wildcard = false, setupRenew = true, staging = false
    } = options;

    if (!email) throw new Error('缺少邮箱 (email)');
    if (!rawDomains) throw new Error('缺少域名 (domains)');
    if (!dnsProvider) throw new Error('缺少 DNS 服务商 (dnsProvider)');
    if (!apiEnv || Object.keys(apiEnv).length === 0) throw new Error('缺少 API 密钥环境变量 (apiEnv)');

    getLegoPath(); // 确保 lego 可用
    let domains = Array.isArray(rawDomains) ? rawDomains : [rawDomains];
    if (wildcard) {
        const newDomains = [...domains];
        for (const d of domains) {
            if (!d.startsWith('*.')) {
                const wildcardDomain = `*.${d}`;
                if (!newDomains.includes(wildcardDomain)) newDomains.push(wildcardDomain);
            }
        }
        domains = newDomains;
    }

    const mainDomain = domains[0], certBaseDir = userCertPath || getDefaultCertPath(),
        legoWorkDir = path.join(certBaseDir, 'lego');
    fs.mkdirSync(legoWorkDir, { recursive: true });

    const certFile = path.join(legoWorkDir, 'certificates', `${mainDomain}.crt`),
        keyFile = path.join(legoWorkDir, 'certificates', `${mainDomain}.key`),

        // ========== 1. 申请证书（如果不存在） ==========
        legoArgs = ['run', '--accept-tos'];
    if (staging) legoArgs.push('--server', acmeDirectory);
    legoArgs.push(
        '--email', email,
        '--domains', domains.join(','),
        '--dns', dnsProvider,
        '--path', legoWorkDir,
    );

    if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
        console.log(`检查到证书缺失!!!,📜 正在申请安装，域名: ${domains.join(', ')}`);
        await runLego(legoArgs, apiEnv);
    }

    if (!fs.existsSync(certFile) || !fs.existsSync(keyFile))
        throw new Error('证书文件生成失败,请检查 lego 输出日志以获取更多信息');

    // ========== 2. 安装自动续期任务 ==========
    let renewTaskConfigured = false;
    if (setupRenew) {
        const alreadyInstalled = await isRenewTaskInstalled(mainDomain);
        if (alreadyInstalled) renewTaskConfigured = true;
        else {
            console.log('自动续期脚本没有找到，正在为您安装自动续期任务...');
            await runPrivilegedInstaller({
                email, domains, mainDomain, dnsProvider, apiEnv, certPath: legoWorkDir, staging,
            }, mainDomain);
            renewTaskConfigured = true;
            console.log('✅ 自动续期任务安装完成。');
        }
    }

    return { domains, certPath: certFile, keyPath: keyFile, renewTaskConfigured };
}
export { setup };