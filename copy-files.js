#!/usr/bin/env node
import { downloadLego } from './lib/lego.js';
downloadLego().catch(err => {
    console.error('下载 lego 失败:', err.message);
    process.exit(1);
});