import { useAppTheme } from '../../constants/theme';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../../services/supabase/client';
import { useAuthStore } from '../../store/useAuthStore';

export function Avatar({ size = 48 }: { size?: number }) {
  const { ClayColors: C } = useAppTheme();
 const profile = useAuthStore(s => s.profile);
 const user = useAuthStore(s => s.user);
 const ownerId = user?.id;
 const avatarPath = profile?.avatar_path;
 const [loaded, setLoaded] = useState<{ path: string; url: string } | null>(null);
 const url = loaded && loaded.path === avatarPath && avatarPath?.startsWith(ownerId + '/') ? loaded.url : null;
 useEffect(() => {
  let active = true;
  if (avatarPath && ownerId && avatarPath.startsWith(ownerId + '/')) {
   void supabase?.storage.from('checkmate-avatars').createSignedUrl(avatarPath, 300).then(({ data }) => {
    if (active) setLoaded(data ? { path: avatarPath, url: data.signedUrl } : null);
   });
  }
  return () => { active = false; };
 }, [avatarPath, ownerId]);
 const initials = (user?.full_name || 'Teacher').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
 return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
  {url ? <Image source={{ uri: url }} cachePolicy="none" style={{ width: size, height: size }} accessibilityLabel="Profile photo" onError={() => setLoaded(null)} />
   : <Text style={{ color: C.onPrimary, fontSize: size * 0.36, fontWeight: '800' }}>{initials}</Text>}
 </View>;
}
