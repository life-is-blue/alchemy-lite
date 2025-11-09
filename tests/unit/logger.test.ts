/**
 * Logger unit tests
 * Philosophy: Test behavior, not implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../src/logger.js';

describe('Logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log info messages as JSON', () => {
    logger.info('Test message', { foo: 'bar' });
    
    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    
    expect(parsed.level).toBe('INFO');
    expect(parsed.message).toBe('Test message');
    expect(parsed.foo).toBe('bar');
    expect(parsed.timestamp).toBeDefined();
  });

  it('should log warnings as JSON', () => {
    logger.warn('Warning message');
    
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    const output = consoleWarnSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    
    expect(parsed.level).toBe('WARN');
    expect(parsed.message).toBe('Warning message');
  });

  it('should log errors as JSON', () => {
    logger.error('Error message', { error: 'Something broke' });
    
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    const output = consoleErrorSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    
    expect(parsed.level).toBe('ERROR');
    expect(parsed.message).toBe('Error message');
    expect(parsed.error).toBe('Something broke');
  });

  it('should include metadata in logs', () => {
    const meta = { userId: 123, action: 'test' };
    logger.info('Action performed', meta);
    
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    
    expect(parsed.userId).toBe(123);
    expect(parsed.action).toBe('test');
  });
});
