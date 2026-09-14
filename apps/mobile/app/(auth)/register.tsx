import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Button, Input } from '../../src/design-system';
import { useApp } from '../../src/hooks/useApp';
import { getServices } from '../../src/lib/ServiceRegistry';
import { apiClient } from '../../src/api/client';
import { User } from '../../src/types';

export default function RegisterScreen() {
  const router = useRouter();
  const { signIn } = useApp();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  async function handleRegister() {
    if (!displayName.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post<{
        data: {
          user: { id: string; email: string; displayName: string };
          accessToken: string;
          refreshToken: string;
          expiresAt: number;
        };
      }>('/auth/register', {
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      const { auth } = getServices();
      const user: User = {
        id: res.data.user.id,
        email: res.data.user.email,
        displayName: res.data.user.displayName,
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        tokenExpiresAt: res.data.expiresAt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await auth.saveSession(user, {
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        expiresAt: res.data.expiresAt,
      });
      signIn(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-50 dark:bg-surface-950"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-10">
          <Text variant="h1" className="mb-1">Create account</Text>
          <Text variant="body" className="text-surface-500">Join FolioSync</Text>
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
            placeholder="Min. 8 characters"
          />
          {error ? <Text variant="caption" className="text-error">{error}</Text> : null}
          <Button label="Create Account" onPress={handleRegister} loading={loading} fullWidth />
        </View>

        <View className="mt-6 flex-row justify-center gap-1">
          <Text variant="caption">Already have an account?</Text>
          <Text
            variant="caption"
            className="text-primary-600 dark:text-primary-400"
            onPress={() => router.back()}
            accessibilityRole="link"
          >
            Sign in
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
