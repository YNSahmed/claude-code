import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { useUpdateProfile } from '@/api/queries';
import { useAuth } from '@/auth/auth-context';
import { Logo } from '@/components/brand';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { haptics } from '@/utils/device';
import { formatPhone } from '@/utils/format';

export default function CompleteProfileScreen() {
  const { user, setUser, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const update = useUpdateProfile();

  const save = () => {
    if (name.trim().length < 2) return;
    update.mutate(name.trim(), {
      onSuccess: ({ user: updated }) => {
        haptics.success();
        setUser(updated);
      },
    });
  };

  return (
    <Screen bottomInset>
      <Logo size={36} />
      <Card style={[styles.card, { marginTop: insets.top > 0 ? 8 : 24 }]}>
        <AppText variant="heading">What should we call you?</AppText>
        <AppText variant="caption">
          Signed in as {user ? formatPhone(user.phone) : ''}. Use the name your squad knows you by.
        </AppText>
        <TextField
          label="Your name"
          placeholder="e.g. Rohan"
          value={name}
          onChangeText={setName}
          maxLength={32}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          error={update.isError ? errorMessage(update.error) : null}
        />
        <Button
          title={update.isPending ? 'Saving…' : 'Continue'}
          icon="arrow-forward"
          size="lg"
          disabled={name.trim().length < 2 || update.isPending}
          onPress={save}
        />
        <Button
          title="Use a different number"
          variant="ghost"
          size="sm"
          onPress={() => void signOut()}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
});
