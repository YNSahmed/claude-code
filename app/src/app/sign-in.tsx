import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, api } from '@/api/client';
import type { User } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { Logo } from '@/components/brand';
import { LegalLinks } from '@/components/legal-links';
import { AgreementNotice } from '@/components/legal-notice';
import { PhoneField, phoneError } from '@/components/phone-field';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Gradients, Radius, type IconName } from '@/constants/theme';
import { MINIMUM_AGE } from '@/constants/business';
import { haptics } from '@/utils/device';
import { formatPhone } from '@/utils/format';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'people',
    title: 'Register your squad',
    text: 'You and your 3 teammates, in under a minute.',
  },
  {
    icon: 'key',
    title: 'Get the room ID',
    text: 'Room ID and password unlock in the app before the match.',
  },
  {
    icon: 'shield-checkmark',
    title: 'Your details stay private',
    text: 'Only the organizer sees names and numbers.',
  },
];

export default function SignInScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  // Age check comes first, before we collect the phone number. Starts unticked.
  const [isAdult, setIsAdult] = useState(false);
  const [ageError, setAgeError] = useState(false);
  const codeInput = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const phone = `+91${digits}`;

  const sendCode = async () => {
    if (!isAdult) {
      setAgeError(true);
      haptics.warning();
      return;
    }
    const invalid = phoneError(digits);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ resendInSeconds: number }>('/auth/otp/request', {
        method: 'POST',
        body: { phone, confirmedAdult: true },
      });
      setStep('code');
      setCode('');
      setResendIn(result.resendInSeconds);
      haptics.success();
      setTimeout(() => codeInput.current?.focus(), 300);
    } catch (e) {
      const retry =
        e instanceof ApiError ? (e.details?.retryAfterSeconds as number | undefined) : undefined;
      if (retry) {
        setStep('code');
        setResendIn(retry);
      }
      setError(e instanceof Error ? e.message : 'Could not send the code.');
      haptics.warning();
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (!/^\d{6}$/.test(value)) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ accessToken: string; user: User }>('/auth/otp/verify', {
        method: 'POST',
        body: { phone, code: value, confirmedAdult: true },
      });
      haptics.success();
      await signIn(result.accessToken, result.user);
    } catch (e) {
      const left =
        e instanceof ApiError ? (e.details?.attemptsLeft as number | undefined) : undefined;
      setError(
        `${e instanceof Error ? e.message : 'Could not verify the code.'}${left !== undefined ? ` ${left} ${left === 1 ? 'try' : 'tries'} left.` : ''}`
      );
      setCode('');
      haptics.warning();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      bottomInset
      hero={
        <LinearGradient
          colors={['#3A1408', Colors.background]}
          style={[styles.hero, { paddingTop: insets.top + 32 }]}>
          <Logo size={44} />
          <AppText variant="display" style={styles.center}>
            Drop in. Clutch up.{'\n'}
            <AppText variant="display" color={Colors.primary}>
              Win big.
            </AppText>
          </AppText>
          <AppText color={Colors.textMuted} style={[styles.center, styles.tagline]}>
            Free Fire squad tournaments. Register with your mobile number.
          </AppText>
        </LinearGradient>
      }>
      {step === 'phone' ? (
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <LinearGradient colors={Gradients.fire} style={styles.featureIcon}>
                <Ionicons name={f.icon} size={18} color={Colors.text} />
              </LinearGradient>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{f.title}</AppText>
                <AppText variant="caption">{f.text}</AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Card>
        {step === 'phone' ? (
          <>
            <AppText variant="heading">Sign in with your mobile</AppText>
            <AppText variant="caption">
              We&apos;ll text you a 6-digit code. No password needed.
            </AppText>
            <PhoneField
              label="Mobile number"
              value={digits}
              onChangeText={(value) => {
                setDigits(value);
                setError(null);
              }}
              returnKeyType="done"
              onSubmitEditing={sendCode}
              error={error}
              autoFocus
            />
            <Checkbox
              checked={isAdult}
              onChange={(value) => {
                setIsAdult(value);
                setAgeError(false);
                setError(null);
              }}
              label={`I am ${MINIMUM_AGE} or older`}
              error={ageError}
            />
            {ageError ? (
              <AppText variant="caption" color={Colors.danger}>
                Clutch Arena is only for players aged {MINIMUM_AGE} or older.
              </AppText>
            ) : null}
            <AgreementNotice action="tapping Send code" />
            <Button
              title={busy ? 'Sending…' : 'Send code'}
              icon="chatbubble-ellipses"
              size="lg"
              disabled={busy}
              onPress={sendCode}
            />
          </>
        ) : (
          <>
            <AppText variant="heading">Enter the code</AppText>
            <AppText variant="caption">
              Sent by SMS to {formatPhone(phone)}. It expires in 5 minutes.
            </AppText>
            <TextInput
              ref={codeInput}
              accessibilityLabel="6-digit code"
              value={code}
              onChangeText={(text) => {
                const value = text.replace(/\D/g, '').slice(0, 6);
                setCode(value);
                setError(null);
                if (value.length === 6) void verify(value);
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={6}
              placeholder="••••••"
              placeholderTextColor={Colors.textFaint}
              selectionColor={Colors.primary}
              style={[styles.codeInput, !!error && styles.codeError]}
            />
            {error ? (
              <AppText variant="caption" color={Colors.danger}>
                {error}
              </AppText>
            ) : null}
            <Button
              title={busy ? 'Checking…' : 'Verify & sign in'}
              icon="checkmark-circle"
              size="lg"
              disabled={busy}
              onPress={() => verify()}
            />
            <View style={styles.row}>
              <Button
                title="Change number"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setStep('phone');
                  setError(null);
                }}
              />
              <Button
                title={resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                variant="ghost"
                size="sm"
                disabled={resendIn > 0 || busy}
                onPress={sendCode}
              />
            </View>
          </>
        )}
      </Card>

      <View style={styles.privacy}>
        <Ionicons name="lock-closed" size={14} color={Colors.textFaint} />
        <AppText variant="caption" color={Colors.textFaint} style={styles.flex}>
          Your number is only used to sign you in and is never shown to other players.
        </AppText>
      </View>
      <LegalLinks />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  center: {
    textAlign: 'center',
  },
  tagline: {
    maxWidth: 320,
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
  codeInput: {
    outlineWidth: 0,
    height: 64,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 32,
    letterSpacing: 12,
    textAlign: 'center',
  },
  codeError: {
    borderColor: Colors.danger,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
