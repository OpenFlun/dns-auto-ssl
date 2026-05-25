import { setupCertificate } from './lib/certificate.js';

export async function setup(options) {
  return setupCertificate(options);
}

// 如果直接执行此文件，也可作为 CLI 的备选