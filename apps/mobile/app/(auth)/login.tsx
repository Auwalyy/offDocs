import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Button, Input } from '../../src/design-system';
import { useApp } from '../../src/hooks/useApp';
import { errorMessage } from '../../src/lib/alerts';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useApp();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (loading) return;
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(errorMessage(e, 'Login failed.'));
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
          <Text variant="h1">Welcome back</Text>
          <Text variant="body" className="text-surface-500">Sign in to FolioSync</Text>
        </View>

        <View className="gap-4">
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
            returnKeyType="next"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            placeholder="••••••••"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          {error ? <Text variant="caption" className="text-error">{error}</Text> : null}
          <Button label="Sign in" onPress={handleLogin} loading={loading} fullWidth />
        </View>

        <View className="mt-6 flex-row justify-center gap-1">
          <Text variant="caption">Don't have an account?</Text>
          <Text
            variant="caption"
            className="text-primary-600 dark:text-primary-400 font-semibold"
            onPress={() => router.push('/(auth)/register')}
            accessibilityRole="link"
          >
            Create one
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
