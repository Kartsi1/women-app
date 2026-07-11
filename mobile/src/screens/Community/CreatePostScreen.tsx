/**
 * CreatePostScreen.tsx — compose and submit a community post (COMM-01).
 *
 * UI-SPEC:
 *   - Navigation header: "New post" + "Cancel" left + "Post" right
 *   - "Post" button: accent (#6200ea) when text non-empty; muted #999999 + disabled when empty
 *   - TextInput multiline, autofocused, Body/16px, placeholder "What's on your mind?"
 *   - PostPhotoAttachment at bottom
 *   - Character count shown as "N/1000" when > 800 chars used
 *   - On submit: "Posting…" + opacity 0.6
 *   - On success: navigation.goBack()
 *   - On error: Alert 'Post not published. Please try again.'
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createPost } from '../../services/api';
import PostPhotoAttachment from '../../components/Community/PostPhotoAttachment';
import type { CommunityStackParamList } from '../../navigation/AppNavigator';

const MAX_TEXT_LENGTH = 1000;
const CHAR_COUNT_THRESHOLD = 800; // show counter when > 800 chars used

type Props = NativeStackScreenProps<CommunityStackParamList, 'CreatePost'>;

export default function CreatePostScreen({ navigation }: Props) {
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isValid = text.trim().length > 0;
  const charsUsed = text.length;
  const showCharCount = charsUsed > CHAR_COUNT_THRESHOLD;

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const result = await createPost(text.trim(), photoUri ?? undefined);
      if (result.data?.id) {
        navigation.goBack();
      } else {
        Alert.alert('Error', result.error ?? 'Post not published. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Post not published. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Navigation header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.navTitle}>New post</Text>

        <TouchableOpacity
          style={[
            styles.postButton,
            !isValid && styles.postButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!isValid || submitting}
          accessibilityLabel={submitting ? 'Posting…' : 'Post'}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.postButtonText,
              !isValid && styles.postButtonTextDisabled,
            ]}
          >
            {submitting ? 'Posting…' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[styles.body, submitting && styles.bodySubmitting]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.bodyContent}
      >
        {/* Text input */}
        <TextInput
          style={styles.textInput}
          multiline
          autoFocus
          placeholder="What's on your mind?"
          placeholderTextColor="#999999"
          value={text}
          onChangeText={setText}
          maxLength={MAX_TEXT_LENGTH}
          editable={!submitting}
          textAlignVertical="top"
          accessibilityLabel="Post text"
        />

        {/* Character count — shown when > 800 chars used */}
        {showCharCount ? (
          <Text style={styles.charCount}>
            {charsUsed}/{MAX_TEXT_LENGTH}
          </Text>
        ) : null}

        {/* Photo attachment */}
        <View style={styles.photoAttachment}>
          <PostPhotoAttachment
            value={photoUri}
            onChange={setPhotoUri}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  navTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111111',
  },
  cancelButton: {
    minWidth: 60,
    paddingVertical: 4,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6200ea',
  },
  postButton: {
    minWidth: 60,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  postButtonDisabled: {
    opacity: 1, // use text color change instead of opacity for button container
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6200ea',
  },
  postButtonTextDisabled: {
    color: '#999999',
  },
  body: {
    flex: 1,
  },
  bodySubmitting: {
    opacity: 0.6,
  },
  bodyContent: {
    padding: 16,
    flexGrow: 1,
  },
  textInput: {
    fontSize: 16,
    fontWeight: '400',
    color: '#111111',
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  charCount: {
    fontSize: 14,
    fontWeight: '400',
    color: '#777777',
    textAlign: 'right',
    marginBottom: 16,
  },
  photoAttachment: {
    marginTop: 8,
  },
});
