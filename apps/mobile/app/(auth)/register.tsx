import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Button, Input } from '../../src/design-system';
import { useApp } from '../../src/hooks/useApp';
import { errorMessage } from '../../src/lib/alerts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useApp();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  async function handleRegister() {
    if (loading) return;
    if (!displayName.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(displayName, email, password);
    } catch (e) {
      setError(errorMessage(e, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-50 dark:bg-surface-950"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-10 gap-2">
          <Text className="text-4xl">📚</Text>
          <Text variant="h1">Create account</Text>
          <Text variant="body" className="text-surface-500">Your documents, available offline and in sync.</Text>
        </View>

        <View className="gap-4">
          <Input
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            placeholder="Your name"
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="At least 8 characters"
            returnKeyType="go"
            onSubmitEditing={handleRegister}
          />
          {error ? <Text variant="caption" className="text-error">{error}</Text> : null}
          <Button label="Create account" onPress={handleRegister} loading={loading} fullWidth />
        </View>

        <View className="mt-6 flex-row justify-center gap-1">
          <Text variant="caption">Already have an account?</Text>
          <Text
            variant="caption"
            className="text-primary-600 dark:text-primary-400 font-semibold"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))}
            accessibilityRole="link"
          >
            Sign in
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
