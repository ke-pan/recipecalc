import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDefaults } from '../useDefaults.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'recipecalc_defaults';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

let store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
};

beforeEach(() => {
  store = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });
  mockLocalStorage.getItem.mockImplementation((key: string) => store[key] ?? null);
  mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
    store[key] = value;
  });
  mockLocalStorage.removeItem.mockImplementation((key: string) => {
    delete store[key];
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDefaults', () => {
  // ---- initial state ----

  describe('initial state', () => {
    it('returns zero defaults when localStorage is empty', () => {
      const { result } = renderHook(() => useDefaults());
      expect(result.current.defaults).toEqual({
        hourlyRate: 0,
        packaging: 0,
        overhead: 0,
        platformFees: 0,
      });
    });

    it('restores valid defaults from localStorage', () => {
      store[STORAGE_KEY] = JSON.stringify({
        hourlyRate: 15,
        packaging: 2,
        overhead: 5,
        platformFees: 1.5,
      });

      const { result } = renderHook(() => useDefaults());
      expect(result.current.defaults.hourlyRate).toBe(15);
      expect(result.current.defaults.packaging).toBe(2);
      expect(result.current.defaults.overhead).toBe(5);
      expect(result.current.defaults.platformFees).toBe(1.5);
    });

    it('clears and returns defaults on corrupt JSON', () => {
      store[STORAGE_KEY] = '{not valid json!!!';

      const { result } = renderHook(() => useDefaults());
      expect(result.current.defaults).toEqual({
        hourlyRate: 0,
        packaging: 0,
        overhead: 0,
        platformFees: 0,
      });
      expect(store[STORAGE_KEY]).toBeUndefined();
    });

    it('clears and returns defaults when stored data has wrong shape', () => {
      store[STORAGE_KEY] = JSON.stringify({ hourlyRate: 'not a number' });

      const { result } = renderHook(() => useDefaults());
      expect(result.current.defaults).toEqual({
        hourlyRate: 0,
        packaging: 0,
        overhead: 0,
        platformFees: 0,
      });
      expect(store[STORAGE_KEY]).toBeUndefined();
    });

    it('clears and returns defaults when stored data is missing fields', () => {
      store[STORAGE_KEY] = JSON.stringify({ hourlyRate: 15 }); // missing other fields

      const { result } = renderHook(() => useDefaults());
      expect(result.current.defaults).toEqual({
        hourlyRate: 0,
        packaging: 0,
        overhead: 0,
        platformFees: 0,
      });
    });
  });

  // ---- update() ----

  describe('update()', () => {
    it('updates a single field', () => {
      const { result } = renderHook(() => useDefaults());

      act(() => {
        result.current.update({ hourlyRate: 20 });
      });

      expect(result.current.defaults.hourlyRate).toBe(20);
      expect(result.current.defaults.packaging).toBe(0); // unchanged
    });

    it('updates multiple fields at once', () => {
      const { result } = renderHook(() => useDefaults());

      act(() => {
        result.current.update({ hourlyRate: 20, packaging: 3, overhead: 5 });
      });

      expect(result.current.defaults.hourlyRate).toBe(20);
      expect(result.current.defaults.packaging).toBe(3);
      expect(result.current.defaults.overhead).toBe(5);
      expect(result.current.defaults.platformFees).toBe(0); // unchanged
    });

    it('writes to localStorage', () => {
      const { result } = renderHook(() => useDefaults());

      act(() => {
        result.current.update({ hourlyRate: 25 });
      });

      const stored = JSON.parse(store[STORAGE_KEY]);
      expect(stored.hourlyRate).toBe(25);
      expect(stored.packaging).toBe(0);
      expect(stored.overhead).toBe(0);
      expect(stored.platformFees).toBe(0);
    });

    it('preserves existing values on partial update', () => {
      store[STORAGE_KEY] = JSON.stringify({
        hourlyRate: 15,
        packaging: 2,
        overhead: 5,
        platformFees: 1.5,
      });

      const { result } = renderHook(() => useDefaults());

      act(() => {
        result.current.update({ packaging: 3 });
      });

      expect(result.current.defaults).toEqual({
        hourlyRate: 15,
        packaging: 3,
        overhead: 5,
        platformFees: 1.5,
      });
    });

    it('handles successive updates correctly', () => {
      const { result } = renderHook(() => useDefaults());

      act(() => {
        result.current.update({ hourlyRate: 10 });
      });
      act(() => {
        result.current.update({ hourlyRate: 20 });
      });

      expect(result.current.defaults.hourlyRate).toBe(20);

      const stored = JSON.parse(store[STORAGE_KEY]);
      expect(stored.hourlyRate).toBe(20);
    });
  });

  // ---- Graceful degradation ----

  describe('graceful degradation', () => {
    it('handles localStorage throwing on getItem', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const { result } = renderHook(() => useDefaults());
      expect(result.current.defaults).toEqual({
        hourlyRate: 0,
        packaging: 0,
        overhead: 0,
        platformFees: 0,
      });
    });

    it('handles localStorage throwing on setItem (quota exceeded)', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const { result } = renderHook(() => useDefaults());

      act(() => {
        result.current.update({ hourlyRate: 25 });
      });

      // State is still updated in memory even if persist fails
      expect(result.current.defaults.hourlyRate).toBe(25);
    });
  });
});
