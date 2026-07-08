import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { api } from '../lib/api';
import { useStoryStore } from '../state/storyStore';
import type { RootStackParamList } from '../navigation/types';

export default function StoriesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [health, setHealth] = useState<string>('checking…');
  const setActiveStory = useStoryStore((s) => s.setActiveStory);

  useEffect(() => {
    api
      .health()
      .then((h) => setHealth(`${h.service} ${h.version} — ${h.status}`))
      .catch((err: unknown) => setHealth(`unreachable (${String(err)})`));
  }, []);

  const openPlaceholderStory = async () => {
    const story = await api.createStory();
    setActiveStory(story.id);
    navigation.navigate('Story', { id: story.id });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stories</Text>
      <Text testID="server-health" style={styles.health}>
        server: {health}
      </Text>
      <Button title="Open placeholder story" onPress={openPlaceholderStory} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  health: { fontSize: 14, color: '#555' },
});
