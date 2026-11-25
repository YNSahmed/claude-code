import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/brand';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Colors, Gradients, type IconName } from '@/constants/theme';
import { useStore } from '@/data/store';
import { digitsOnly, validateIgn, validateUid } from '@/data/validation';
import { haptics } from '@/utils/device';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'trophy',
    title: 'Join in seconds',
    text: 'Pick a Solo, Duo or Squad tournament and register your team.',
  },
  {
    icon: 'key',
    title: 'Get the room ID',
    text: 'Room ID and password appear in the app right before the match.',
  },
  { icon: 'podium', title: 'Win prizes', text: 'Climb the leaderboard and earn for every kill.' },
];

export default function OnboardingScreen() {
  const { saveProfile } = useStore();
  const insets = useSafeAreaInsets();
  const [ign, setIgn] = useState('');
  const [uid, setUid] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const ignError = submitted ? validateIgn(ign) : null;
  const uidError = submitted ? validateUid(uid) : null;

  const submit = () => {
    setSubmitted(true);
    const result = saveProfile({ ign, uid });
    if (result.ok) haptics.success();
    else haptics.warning();
  };

  return (
    <Screen
      bottomInset
      hero={
        <LinearGradient
          colors={['#3A1408', Colors.background]}
          style={[styles.hero, { paddingTop: insets.top + 32 }]}>
          <Logo size={44} />
          <AppText variant="display" style={styles.headline}>
            Drop in. Clutch up.{'\n'}
            <AppText variant="display" color={Colors.primary}>
              Win big.
            </AppText>
          </AppText>
          <AppText color={Colors.textMuted} style={styles.center}>
            Join Free Fire custom-room tournaments, or host your own, in a few taps.
          </AppText>
        </LinearGradient>
      }>
      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.feature}>
            <LinearGradient colors={Gradients.fire} style={styles.featureIcon}>
              <Ionicons name={f.icon} size={18} color={Colors.text} />
            </LinearGradient>
            <View style={styles.featureText}>
              <AppText variant="bodyStrong">{f.title}</AppText>
              <AppText variant="caption">{f.text}</AppText>
            </View>
          </View>
        ))}
      </View>

      <Card>
        <AppText variant="heading">Create your player card</AppText>
        <AppText variant="caption">
          Use the same name and ID as in the game, so organizers can find you in the room.
        </AppText>
        <TextField
          label="In-game name (IGN)"
          placeholder="e.g. ShadowX"
          value={ign}
          onChangeText={setIgn}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          returnKeyType="next"
          error={ignError}
        />
        <TextField
          label="Player ID (UID)"
          placeholder="e.g. 1234567890"
          value={uid}
          onChangeText={(text) => setUid(digitsOnly(text))}
          keyboardType="number-pad"
          maxLength={12}
          returnKeyType="done"
          onSubmitEditing={submit}
          error={uidError}
          hint="Find it under your profile picture in the game."
        />
        <Button title="Enter the arena" icon="flame" size="lg" onPress={submit} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 16,
  },
  headline: {
    textAlign: 'center',
    marginTop: 12,
  },
  center: {
    textAlign: 'center',
    maxWidth: 340,
  },
  features: {
    gap: 14,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
});
