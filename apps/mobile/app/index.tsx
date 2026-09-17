import { Redirect } from 'expo-router';
import { useApp } from '../src/hooks/useApp';

export default function Index() {
  const { user } = useApp();
  return <Redirect href={user ? '/(app)/workspace' : '/(auth)/login'} />;
}
