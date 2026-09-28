import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, Input, Button, Chip } from '../design-system';
import { TagSummary } from '../types';
import { normalizeTags, MAX_TAG_LENGTH } from '../features/tags/TagRepository';
import { errorMessage } from '../lib/alerts';

interface Props {
  visible: boolean;
  documentName: string;
  initialTags: string[];
  /** Tags already used elsewhere, offered as suggestions. */
  allTags: TagSummary[];
  onClose: () => void;
  onSave: (tags: string[]) => Promise<void>;
}

export function TagEditorModal({ visible, documentName, initialTags, allTags, onClose, onSave }: Props) {
  const [tags, setTags]   = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTags(initialTags);
      setDraft('');
      setError('');
    }
  }, [visible, initialTags]);

  const suggestions = useMemo(() => {
    const have = new Set(tags.map((t) => t.toLowerCase()));
    const q = draft.trim().toLowerCase();
    return allTags
      .filter((t) => !have.has(t.name.toLowerCase()) && (!q || t.name.toLowerCase().includes(q)))
      .slice(0, 12);
  }, [allTags, tags, draft]);

  function add(name: string) {
    try {
      setTags(normalizeTags([...tags, name]));
      setDraft('');
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // A typed but not yet added tag is saved too.
      const final = draft.trim() ? normalizeTags([...tags, draft]) : tags;
      await onSave(final);
    } catch (e) {
      setError(errorMessage(e, 'Could not save tags.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Pressable className="flex-1 bg-black/50 justify-center px-6" onPress={onClose} accessibilityLabel="Close">
          <Pressable className="bg-white dark:bg-surface-800 rounded-xl p-6 gap-4 max-h-[85%]" onPress={(e) => e.stopPropagation()}>
            <View>
              <Text variant="h3">Tags</Text>
              <Text variant="caption" numberOfLines={1}>{documentName}</Text>
            </View>

            <ScrollView className="max-h-32" contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tags.length === 0 ? (
                <Text variant="caption">No tags yet. Add one below, e.g. “Exam” or “CSC 401”.</Text>
              ) : (
                tags.map((t) => <Chip key={t} label={`#${t}`} onRemove={() => setTags(tags.filter((x) => x !== t))} />)
              )}
            </ScrollView>

            <Input
              label="Add a tag"
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a tag and press enter"
              maxLength={MAX_TAG_LENGTH}
              autoCapitalize="words"
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={() => draft.trim() && add(draft)}
              error={error}
            />

            {suggestions.length > 0 ? (
              <View className="gap-2">
                <Text variant="label" className="text-xs uppercase tracking-wide text-surface-400">Your tags</Text>
                <View className="flex-row flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <Chip key={s.name} label={`+ ${s.name}`} size="sm" onPress={() => add(s.name)} accessibilityLabel={`Add tag ${s.name}`} />
                  ))}
                </View>
              </View>
            ) : null}

            <View className="flex-row gap-3">
              <Button label="Cancel" variant="ghost" onPress={onClose} className="flex-1" />
              <Button label="Save" onPress={handleSave} loading={saving} className="flex-1" />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
