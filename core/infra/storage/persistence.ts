/**
 * Infrastructure Layer: Persistent Storage Interface
 */

export interface StoragePort {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export class LocalStorageAdapter implements StoragePort {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}

export const defaultStorage = new LocalStorageAdapter();
