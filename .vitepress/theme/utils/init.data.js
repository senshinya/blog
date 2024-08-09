import { execSync } from 'child_process';

try {
    execSync('node .vitepress/theme/utils/heatmap.data.js', { stdio: 'inherit' });
    console.log('heatmap.data.js 执行成功');
} catch (error) {
    console.error('执行 heatmap.data.js 时发生错误:', error);
}