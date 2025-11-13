/**
 * extractPathPrefix 单元测试
 * 
 * 测试URL路径前缀提取逻辑，确保批量爬取时能正确过滤同域名链接
 */

import { describe, it, expect } from 'vitest';

// 直接定义extractPathPrefix函数（从public/app.js复制）
function extractPathPrefix(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // 规则1: 如果路径以.html/.htm/.php/.asp结尾，去掉文件名
    if (/\.(html?|php|asp)$/i.test(path)) {
      return path.substring(0, path.lastIndexOf('/') + 1);
    }
    
    // 规则2: 如果路径以/结尾，直接使用
    if (path.endsWith('/')) {
      return path;
    }
    
    // 规则3: 提取父目录路径
    // - /docs/api/chat -> /docs/api/ (多级路径)
    // - /docs -> / (一级路径)
    // - / -> / (根路径)
    const lastSlashIndex = path.lastIndexOf('/');
    if (lastSlashIndex >= 0) {
      return path.substring(0, lastSlashIndex + 1);
    }
    
    // 兜底: 根目录（理论上不会到这里）
    return '/';
    
  } catch (error) {
    throw new Error('Invalid URL for crawl prefix extraction');
  }
}

describe('extractPathPrefix', () => {
  describe('规则1: HTML文件路径', () => {
    it('应该处理.html文件', () => {
      const result = extractPathPrefix('https://example.com/docs/page.html');
      expect(result).toBe('/docs/');
    });

    it('应该处理.htm文件', () => {
      const result = extractPathPrefix('https://example.com/docs/guide.htm');
      expect(result).toBe('/docs/');
    });

    it('应该处理.php文件', () => {
      const result = extractPathPrefix('https://example.com/api/index.php');
      expect(result).toBe('/api/');
    });

    it('应该处理.asp文件', () => {
      const result = extractPathPrefix('https://example.com/legacy/page.asp');
      expect(result).toBe('/legacy/');
    });

    it('应该处理大小写不敏感的扩展名', () => {
      const result = extractPathPrefix('https://example.com/docs/Page.HTML');
      expect(result).toBe('/docs/');
    });
  });

  describe('规则2: 以/结尾的路径', () => {
    it('应该保持以/结尾的目录路径', () => {
      const result = extractPathPrefix('https://example.com/docs/api/');
      expect(result).toBe('/docs/api/');
    });

    it('应该保持根路径/', () => {
      const result = extractPathPrefix('https://example.com/');
      expect(result).toBe('/');
    });
  });

  describe('规则3: 提取父目录', () => {
    it('应该从多级路径中提取父目录 - moonshot案例', () => {
      const result = extractPathPrefix('https://platform.moonshot.cn/docs/api/chat');
      expect(result).toBe('/docs/api/');
    });

    it('应该从多级路径中提取父目录 - python docs案例', () => {
      const result = extractPathPrefix('https://docs.python.org/3/tutorial/introduction');
      expect(result).toBe('/3/tutorial/');
    });

    it('应该从一级路径中提取根目录', () => {
      const result = extractPathPrefix('https://example.com/docs');
      expect(result).toBe('/');
    });

    it('应该处理根路径（边界case）', () => {
      const result = extractPathPrefix('https://example.com/');
      expect(result).toBe('/');
    });
  });

  describe('错误处理', () => {
    it('应该拒绝无效URL', () => {
      expect(() => extractPathPrefix('not-a-url')).toThrow('Invalid URL');
    });

    it('应该拒绝空字符串', () => {
      expect(() => extractPathPrefix('')).toThrow('Invalid URL');
    });
  });

  describe('真实场景回归测试', () => {
    it('BUG回归: moonshot文档应正确爬取同级页面', () => {
      // 原Bug: /docs/api/chat 被处理为 /docs/api/chat/
      // 导致同级页面 /docs/api/embeddings 被过滤
      const result = extractPathPrefix('https://platform.moonshot.cn/docs/api/chat');
      expect(result).toBe('/docs/api/');
    });

    it('BUG回归: python文档应正确爬取tutorial下所有页面', () => {
      // 验证修复后能正确处理python文档的多级路径
      const result = extractPathPrefix('https://docs.python.org/3/tutorial/introduction.html');
      expect(result).toBe('/3/tutorial/');
    });
  });
});
