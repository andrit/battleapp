/**
 * ReadingControlsSheet — the "Aa" bottom sheet (client-state-ux.md §B). Pure client state: a font
 * stepper (S/M/L/XL), a reading-comfort toggle (airier line-height), and a Warm / Bright white
 * paper segmented control. Changes apply live to the scroll behind it (StorySection reads the same
 * prefs store). A mini human/AI preview shows that the AI cool-slate tint holds on either paper.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferencesStore } from '../state/preferencesStore';
import { clampFontStep, fontStepLabel, paperColor, readingStoryStyle } from '../theme/reading';
import { color, radius, space, type, minTapTarget } from '../theme/tokens';

export function ReadingControlsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reading = usePreferencesStore((s) => s.reading);
  const setFontStep = usePreferencesStore((s) => s.setFontStep);
  const setComfort = usePreferencesStore((s) => s.setComfort);
  const setPaper = usePreferencesStore((s) => s.setPaper);

  const previewStyle = readingStoryStyle(reading);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable testID="reading-scrim" style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <Text style={styles.heading}>Reading</Text>

        {/* Font size stepper */}
        <View style={styles.row}>
          <Pressable
            testID="font-smaller"
            onPress={() => setFontStep(clampFontStep(reading.fontStep - 1))}
            accessibilityRole="button"
            accessibilityLabel="Smaller text"
            style={styles.stepBtn}
          >
            <Text style={styles.stepMinus}>A</Text>
          </Pressable>
          <Text testID="font-label" style={styles.rowLabel}>
            Size · {fontStepLabel(reading.fontStep)}
          </Text>
          <Pressable
            testID="font-larger"
            onPress={() => setFontStep(clampFontStep(reading.fontStep + 1))}
            accessibilityRole="button"
            accessibilityLabel="Larger text"
            style={styles.stepBtn}
          >
            <Text style={styles.stepPlus}>A</Text>
          </Pressable>
        </View>

        {/* Reading comfort */}
        <Pressable
          testID="comfort-toggle"
          onPress={() => setComfort(!reading.comfort)}
          accessibilityRole="switch"
          accessibilityState={{ checked: reading.comfort }}
          style={styles.row}
        >
          <Text style={styles.rowLabel}>Comfortable spacing</Text>
          <View style={[styles.switch, reading.comfort && styles.switchOn]}>
            <View style={[styles.knob, reading.comfort && styles.knobOn]} />
          </View>
        </Pressable>

        {/* Paper segmented */}
        <View style={styles.segment}>
          <Pressable
            testID="paper-warm"
            onPress={() => setPaper('warm')}
            accessibilityRole="button"
            style={[styles.segItem, reading.paper === 'warm' && styles.segItemOn]}
          >
            <Text style={[styles.segText, reading.paper === 'warm' && styles.segTextOn]}>Warm</Text>
          </Pressable>
          <Pressable
            testID="paper-white"
            onPress={() => setPaper('white')}
            accessibilityRole="button"
            style={[styles.segItem, reading.paper === 'white' && styles.segItemOn]}
          >
            <Text style={[styles.segText, reading.paper === 'white' && styles.segTextOn]}>
              Bright white
            </Text>
          </Pressable>
        </View>

        {/* Mini human/AI preview — the AI tint stays cool-slate on either paper. */}
        <View style={[styles.preview, { backgroundColor: paperColor(reading.paper) }]}>
          <Text style={[previewStyle, { color: color.ink900 }]}>You wrote this line.</Text>
          <View style={styles.previewAi}>
            <Text style={[previewStyle, { color: color.ink700 }]}>The AI answered here.</Text>
          </View>
        </View>
        <Text style={styles.note}>Paper changes the story only — AI sections stay cool-slate.</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.16)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space[5],
    gap: space[4],
  },
  heading: { ...type.title, color: color.ink900 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: minTapTarget,
  },
  rowLabel: { ...type.body, color: color.ink700 },
  stepBtn: {
    minHeight: minTapTarget,
    minWidth: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
  },
  stepMinus: { fontSize: 15, color: color.ink700 },
  stepPlus: { fontSize: 22, color: color.ink700 },

  switch: {
    width: 44,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: color.line,
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: color.primary },
  knob: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: color.surface },
  knobOn: { alignSelf: 'flex-end' },

  segment: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    overflow: 'hidden',
  },
  segItem: { flex: 1, minHeight: minTapTarget, alignItems: 'center', justifyContent: 'center' },
  segItemOn: { backgroundColor: color.primaryTint },
  segText: { ...type.label, color: color.ink500 },
  segTextOn: { color: color.primary },

  preview: { borderRadius: radius.md, padding: space[3], gap: space[2] },
  previewAi: {
    backgroundColor: color.aiTint,
    borderLeftWidth: 2,
    borderLeftColor: color.aiLine,
    borderRadius: radius.sm,
    paddingVertical: space[1],
    paddingHorizontal: space[2],
  },
  note: { ...type.caption, color: color.ink500 },
});

export default ReadingControlsSheet;
