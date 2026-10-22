import { describe, expect, it, beforeEach } from 'bun:test';
import {
  activateProactive,
  deactivateProactive,
  getNextTickAt,
  isProactiveActive,
  isProactivePaused,
  pauseProactive,
  resumeProactive,
  setNextTickAt,
  subscribeToProactiveChanges,
} from '../index.js';

describe('proactive module', () => {
  beforeEach(() => {
    deactivateProactive();
  });

  it('getNextTickAt returns null by default', () => {
    expect(getNextTickAt()).toBeNull();
  });

  it('setNextTickAt updates getNextTickAt', () => {
    const t = Date.now() + 60_000;
    setNextTickAt(t);
    expect(getNextTickAt()).toBe(t);
  });

  it('setNextTickAt(null) resets to null', () => {
    setNextTickAt(Date.now() + 60_000);
    setNextTickAt(null);
    expect(getNextTickAt()).toBeNull();
  });

  it('activateProactive resets nextTickAt to null', () => {
    setNextTickAt(Date.now() + 60_000);
    activateProactive('test');
    expect(getNextTickAt()).toBeNull();
    expect(isProactiveActive()).toBe(true);
  });

  it('deactivateProactive resets nextTickAt to null', () => {
    activateProactive('test');
    setNextTickAt(Date.now() + 60_000);
    deactivateProactive();
    expect(getNextTickAt()).toBeNull();
    expect(isProactiveActive()).toBe(false);
  });

  it('pauseProactive clears nextTickAt so countdown UI hides', () => {
    activateProactive('test');
    setNextTickAt(Date.now() + 60_000);
    pauseProactive();
    expect(getNextTickAt()).toBeNull();
    expect(isProactivePaused()).toBe(true);
  });

  it('resumeProactive does not restore a previously cleared nextTickAt', () => {
    activateProactive('test');
    setNextTickAt(Date.now() + 60_000);
    pauseProactive();
    resumeProactive();
    expect(getNextTickAt()).toBeNull();
    expect(isProactivePaused()).toBe(false);
  });

  it('emits change notifications when nextTickAt changes', () => {
    let calls = 0;
    const unsub = subscribeToProactiveChanges(() => {
      calls += 1;
    });
    try {
      setNextTickAt(Date.now() + 60_000);
      expect(calls).toBe(1);
      setNextTickAt(null);
      expect(calls).toBe(2);
    } finally {
      unsub();
    }
  });
});
