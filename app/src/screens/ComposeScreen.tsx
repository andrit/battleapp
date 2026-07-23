/**
 * ComposeScreen — TEMPORARY minimal implementation (Phase 4 Task 4).
 *
 * This keeps the submit loop working end-to-end while StoryScreen becomes the read-only
 * Story View. Task 5 replaces this body with the designed Compose: KeyboardAvoidingView,
 * serif input on the chosen paper, live 500-char counter, dismissible AI director-hint card,
 * and the coral "Turn posted" acknowledgement. The optimistic B5 rollback already lives in
 * useSubmitTurn (lib/queries.ts) and is exercised here.
 */
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSubmitTurn } from '../lib/queries';
import { color, radius, space, type } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Compose'>;

export default function ComposeScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const submit = useSubmitTurn(id);
  const [draft, setDraft] = useState('');

  const onSubmit = () => {
    const text = draft.trim();
    if (!text) return;
    // Clear + close only on success — on error (B5) the draft stays for retry.
    submit.mutate(text, {
      onSuccess: () => {
        setDraft('');
        navigation.goBack();
      },
    });
  };

  return (
    <View style={styles.container}>
      {submit.isError && (
        <Text style={styles.error}>{"Couldn't post — tap Submit to retry."}</Text>
      )}
      <TextInput
        testID="turn-input"
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder="Write a turn…"
        placeholderTextColor={color.ink300}
        multiline
        autoFocus
      />
      <Button title="Submit" onPress={onSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space[4], gap: space[3], backgroundColor: color.surface },
  input: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space[3],
    minHeight: 70,
    ...type.story,
    color: color.ink900,
  },
  error: { ...type.caption, color: color.error },
});
