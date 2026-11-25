import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen, ScreenHeader } from '@/components/ui/screen';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen header={<ScreenHeader title="Not found" />} bottomInset>
      <EmptyState
        icon="compass-outline"
        title="This page doesn't exist"
        message="Let's get you back to the action."
        actionLabel="Go to tournaments"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
