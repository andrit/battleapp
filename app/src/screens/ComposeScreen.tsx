/**
 * ComposeScreen — the your-turn input (screen-states.md #11), presented as a modal over Story View.
 *
 * Serif input on the reader's paper · live 500-char counter (turns error past the limit) · a
 * dismissible AI **director-hint** card (teal entrance, fetched from the stall-gated endpoint,
 * never disrupts input focus) · Submit bottom-right in the thumb zone · **B5 rollback** on error
 * (the optimistic Section is removed by useSubmitTurn, the draft is kept, a retry line shows) ·
 * a coral **"Turn posted ✓"** acknowledgement on success before the modal closes.
 *
 * Keyboard avoidance follows docs/engineering/decision-keyboard-avoidance.md (modal branch):
 * iOS `KeyboardAvoidingView behavior="padding"` with the header-height offset; Android relies on
 * `softwareKeyboardLayoutMode:"resize"` (app.json) — no KAV behavior, to avoid a double offset.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useDirectorHint, useStory, useSubmitTurn } from '../lib/queries';
import { usePreferencesStore } from '../state/preferencesStore';
import { paperColor } from '../theme/reading';
import { color, radius, space, type, minTapTarget } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Compose'>;

const CHAR_LIMIT = 500;
const ACK_MS = 900; // how long the coral "Turn posted" ack shows before the modal closes

export default function ComposeScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const story = useStory(id);
  const submit = useSubmitTurn(id);
  const hint = useDirectorHint(id);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const paper = usePreferencesStore((s) => s.reading.paper);
  const [draft, setDraft] = useState('');
  const [hintDismissed, setHintDismissed] = useState(false);
  const [posted, setPosted] = useState(false);

  // The post-success ack timer that closes the modal; cleared on unmount so it never fires
  // goBack() on an already-dismissed screen (and never lingers as an open handle).
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const trimmed = draft.trim();
  const over = draft.length > CHAR_LIMIT;
  const canSubmit = trimmed.length > 0 && !over && !submit.isPending && !posted;

  const lastTurn = story.data?.turns.at(-1) ?? null;
  const hintText = !hintDismissed ? (hint.data?.hint ?? null) : null;

  const onSubmit = useCallback(() => {
    if (!canSubmit) return;
    submit.mutate(trimmed, {
      onSuccess: () => {
        // Coral acknowledgement (screen-states: "the human acted"), then close back to Story View.
        setPosted(true);
        setDraft('');
        closeTimer.current = setTimeout(() => navigation.goBack(), ACK_MS);
      },
      // Error path is B5: useSubmitTurn rolls the optimistic Section back; the draft stays here.
    });
  }, [canSubmit, submit, trimmed, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <View style={[styles.body, { backgroundColor: paperColor(paper) }]}>
        {lastTurn && (
          <Text style={[type.story, styles.context]} numberOfLines={3}>
            {lastTurn.content}
          </Text>
        )}

        {hintText && (
          <Animated.View
            testID="director-hint"
            entering={FadeInDown.springify().damping(18)}
            style={styles.hintCard}
          >
            <View style={styles.hintRow}>
              <Text style={styles.hintLabel}>{`◆ Hint`}</Text>
              <Pressable
                testID="dismiss-hint"
                onPress={() => setHintDismissed(true)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Dismiss hint"
              >
                <Text style={styles.hintDismiss}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.hintText}>{hintText}</Text>
          </Animated.View>
        )}

        {submit.isError && (
          <Text testID="submit-error" style={styles.error}>
            {"Couldn't post — tap Submit to retry."}
          </Text>
        )}

        <TextInput
          testID="turn-input"
          style={[type.story, styles.input]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write your turn…"
          placeholderTextColor={color.ink300}
          multiline
          autoFocus
          scrollEnabled
        />

        <View style={styles.footer}>
          <Text testID="char-counter" style={[styles.counter, over && styles.counterOver]}>
            {`${draft.length} / ${CHAR_LIMIT}`}
          </Text>
          <Pressable
            testID="submit"
            onPress={onSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
          >
            <Text style={styles.submitText}>Submit ›</Text>
          </Pressable>
        </View>

        <View style={{ height: insets.bottom }} />
      </View>

      {posted && (
        <View testID="posted-ack" style={styles.ackWrap} pointerEvents="none">
          <View style={styles.ackToast}>
            <Text style={styles.ackText}>Turn posted ✓</Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, padding: space[4], gap: space[3] },

  context: { color: color.ink500, fontSize: 15, lineHeight: 24 },

  // Director-hint card: cool AI palette + a teal-electric left accent (the "AI moment").
  hintCard: {
    backgroundColor: color.aiTint,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: color.tealElectric,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    gap: 2,
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hintLabel: { ...type.micro, color: color.aiInk },
  hintDismiss: { ...type.label, color: color.aiInk },
  hintText: { ...type.body, color: color.aiInk },

  error: { ...type.caption, color: color.error },

  input: {
    flex: 1,
    maxHeight: 160,
    color: color.ink900,
    textAlignVertical: 'top',
  },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { ...type.caption, color: color.ink500 },
  counterOver: { color: color.error },
  submit: {
    minHeight: minTapTarget,
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[5],
    borderRadius: radius.md,
    backgroundColor: color.primary,
  },
  submitDisabled: { backgroundColor: color.ink300 },
  submitText: { ...type.label, color: color.primaryInk },

  // Coral "Turn posted ✓" ack — sits above the thumb zone, bottom-center.
  ackWrap: { position: 'absolute', left: 0, right: 0, bottom: space[14], alignItems: 'center' },
  ackToast: {
    backgroundColor: color.coral,
    borderRadius: radius.pill,
    paddingVertical: space[2],
    paddingHorizontal: space[4],
  },
  ackText: { ...type.label, color: '#FFFFFF' },
});
