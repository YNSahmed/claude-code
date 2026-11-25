import { usePreventScreenCapture } from 'expo-screen-capture';
import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useUsers } from '@/api/queries';
import { AppText } from '@/components/ui/app-text';
import { Pill } from '@/components/ui/badges';
import { IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { callPhone, openWhatsAppChat } from '@/components/whatsapp';
import { Colors, WhatsAppGreen } from '@/constants/theme';
import { formatPhone } from '@/utils/format';

function NoScreenshots() {
  usePreventScreenCapture('admin-players');
  return null;
}

export default function PlayersScreen() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error } = useUsers(search.trim());

  return (
    <Screen header={<ScreenHeader title="Players" />} bottomInset>
      {Platform.OS !== 'web' ? <NoScreenshots /> : null}
      <TextField
        label="Search by name or number"
        placeholder="e.g. Rohan or 98765"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />
      {isLoading ? <ActivityIndicator color={Colors.primary} /> : null}
      {isError ? (
        <AppText variant="caption" color={Colors.danger}>
          {errorMessage(error)}
        </AppText>
      ) : null}
      <AppText variant="caption">
        {data ? `${data.length} account${data.length === 1 ? '' : 's'}` : ''}
      </AppText>
      {(data ?? []).map((u) => (
        <Card key={u.id} style={styles.row}>
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <AppText variant="bodyStrong">{u.displayName ?? 'New player'}</AppText>
              {u.role === 'admin' ? <Pill label="Organizer" color={Colors.gold} /> : null}
              {u.isBanned ? <Pill label="Banned" color={Colors.danger} /> : null}
            </View>
            <AppText variant="caption" selectable>
              {formatPhone(u.phone)} · {u.squadsRegistered} squad
              {u.squadsRegistered === 1 ? '' : 's'} as captain
            </AppText>
          </View>
          <IconButton
            icon="call-outline"
            accessibilityLabel={`Call ${u.displayName ?? u.phone}`}
            onPress={() => callPhone(u.phone)}
            style={styles.icon}
          />
          <IconButton
            icon="logo-whatsapp"
            color={WhatsAppGreen}
            accessibilityLabel={`WhatsApp ${u.displayName ?? u.phone}`}
            onPress={() => openWhatsAppChat(u.phone)}
            style={styles.icon}
          />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  icon: {
    width: 36,
    height: 36,
  },
});
