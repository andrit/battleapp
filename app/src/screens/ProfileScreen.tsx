import { StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../state/authStore';

export default function ProfileScreen() {
  const displayName = useAuthStore((s) => s.player?.display_name ?? null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.hint}>{displayName ?? 'Not signed in — auth lands in Phase 4.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { fontSize: 24, fontWeight: '600' },
  hint: { fontSize: 14, color: '#555', textAlign: 'center' },
});
