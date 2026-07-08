import { useCallback, useEffect, useState } from 'react';
import { Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { api, type StubStory } from '../lib/api';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Story'>;

export default function StoryScreen({ route }: Props) {
  const { id } = route.params;
  const [story, setStory] = useState<StubStory | null>(null);
  const [draft, setDraft] = useState('');

  const refresh = useCallback(() => {
    api.getStory(id).then(setStory).catch(console.warn);
  }, [id]);

  useEffect(refresh, [refresh]);

  const submit = async () => {
    if (!draft.trim()) return;
    await api.submitTurn(id, draft.trim());
    setDraft('');
    refresh();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Story (placeholder)</Text>
      <Text style={styles.meta}>
        {story ? `state: ${story.state} · turns: ${story.turns.length}` : 'loading…'}
      </Text>
      <FlatList
        style={styles.scroll}
        data={story?.turns ?? []}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <View style={styles.turn}>
            <Text style={styles.turnMeta}>
              #{item.sequence_number} · {item.author_type}
            </Text>
            <Text style={styles.turnContent}>{item.content}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.hint}>No turns yet — write the first one.</Text>}
      />
      <TextInput
        testID="turn-input"
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder="Write a turn (stub)…"
        multiline
      />
      <Button title="Submit turn" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: '600' },
  meta: { fontSize: 13, color: '#555' },
  scroll: { flex: 1 },
  turn: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  turnMeta: { fontSize: 12, color: '#888' },
  turnContent: { fontSize: 16 },
  hint: { fontSize: 14, color: '#555', paddingVertical: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, minHeight: 60 },
});
