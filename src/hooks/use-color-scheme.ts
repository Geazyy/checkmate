import { useAppearanceStore } from '../store/useAppearanceStore';

export function useColorScheme() {
  return useAppearanceStore(state => state.mode);
}
