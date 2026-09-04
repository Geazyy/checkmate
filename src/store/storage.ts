import { Platform } from 'react-native';
import SQLiteStorage from 'expo-sqlite/kv-store';
import { StateStorage } from 'zustand/middleware';

const browserStorage: StateStorage = {
  getItem: async (name) => globalThis.localStorage?.getItem(name) ?? null,
  setItem: async (name, value) => globalThis.localStorage?.setItem(name, value),
  removeItem: async (name) => globalThis.localStorage?.removeItem(name),
};

export const appStorage: StateStorage = Platform.OS === 'web' ? browserStorage : SQLiteStorage;
