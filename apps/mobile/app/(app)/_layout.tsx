import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTintColor: '#3B82F6',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
