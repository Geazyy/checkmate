import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
const temporary = new Set<string>();
// Only app-created cache files are eligible. Never delete gallery originals.
export function trackPrivateImage(uri?: string) {
 if (uri && Platform.OS !== 'web' && uri.startsWith(Paths.cache.uri)) temporary.add(uri);
 return uri;
}
export function clearTemporaryImages(retained: string[] = []) {
 const keep = new Set(retained);
 for (const uri of temporary) {
  if (keep.has(uri)) { temporary.delete(uri); continue; }
  try {
   const file = new File(uri);
   if (file.exists && file.uri.startsWith(Paths.cache.uri)) file.delete();
   temporary.delete(uri);
  } catch { /* Retry when cleanup next runs; do not remove saved scans. */ }
 }
}
