import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { APP_NAME } from '@/constants/config';
import { Colors, Fonts, Gradients } from '@/constants/theme';

import { AppText } from './ui/app-text';

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <LinearGradient
      colors={Gradients.fire}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.mark, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Ionicons name="flame" size={size * 0.6} color={Colors.text} />
    </LinearGradient>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  const [first, ...rest] = APP_NAME.toUpperCase().split(' ');
  return (
    <View style={styles.row}>
      <LogoMark size={size} />
      <AppText style={[styles.word, { fontSize: size * 0.62 }]}>
        {first}{' '}
        <AppText style={[styles.word, { fontSize: size * 0.62, color: Colors.primary }]}>
          {rest.join(' ')}
        </AppText>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  word: {
    fontFamily: Fonts.display,
    letterSpacing: 1.5,
    color: Colors.text,
  },
});
