import { useState } from 'react';
import { Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useStory, useSubmitTurn } from '../lib/queries';
import { useStoryWebSocket } from '../lib/storyWebSocket';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Story'>;

export default function StoryScreen({ route }: Props) {
  const { id } = route.params;
  const story = useStory(id);
  const submit = useSubmitTurn(id);
  useStoryWebSocket(id); // live TurnAdded → patches the story cache
  const [draft, setDraft] = useState('');

  const turns = story.data?.turns ?? [];
  const meta = story.data
    ? `state: ${story.data.state} · turns: ${turns.length}`
    : story.isError
      ? 'failed to load'
      : 'loading…';

  const onSubmit = () => {
    const text = draft.trim();
    if (!text) return;
    // Clear the draft only on success — on error (B5) it stays for retry.
    submit.mutate(text, { onSuccess: () => setDraft('') });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Story (placeholder)</Text>
      <Text style={styles.meta}>{meta}</Text>
      <FlatList
        style={styles.scroll}
        data={turns}
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
      {submit.isError && (
        <Text style={styles.error}>{"Couldn't send — tap Submit to retry."}</Text>
      )}
      <TextInput
        testID="turn-input"
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder="Write a turn (stub)…"
        multiline
      />
      <Button title="Submit turn" onPress={onSubmit} />
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
  error: { fontSize: 13, color: '#b00020' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, minHeight: 60 },
});
