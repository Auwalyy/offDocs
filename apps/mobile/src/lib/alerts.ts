import { Alert } from 'react-native';

export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function showError(title: string, err: unknown): void {
  Alert.alert(title, errorMessage(err));
}

export function confirmDelete(title: string, message: string, onConfirm: () => void | Promise<void>): void {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void onConfirm() },
  ]);
}
