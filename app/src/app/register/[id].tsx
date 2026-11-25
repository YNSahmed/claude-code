import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ApiError, errorMessage, newIdempotencyKey } from '@/api/client';
import { useMySquad, useRegisterSquad, useTournament } from '@/api/queries';
import { useAuth } from '@/auth/auth-context';
import { LegalLink } from '@/components/legal-notice';
import { PhoneField, phoneError } from '@/components/phone-field';
import { AppText } from '@/components/ui/app-text';
import { ModeBadge } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { MAP_LABEL, MODE_LABEL } from '@/constants/config';
import { Colors, MapStyles, Radius } from '@/constants/theme';
import { haptics } from '@/utils/device';
import { formatDateTime, formatMoney, formatPhone } from '@/utils/format';
import { isRegistrationOpen, teamWord } from '@/utils/tournament';

interface Mate {
  name: string;
  phone: string;
  uid: string;
}

const emptyMate = (): Mate => ({ name: '', phone: '', uid: '' });
const nameError = (name: string) => (name.trim().length < 2 ? 'Enter a name (2+ letters)' : null);
const uidError = (uid: string) => (uid && !/^\d{6,12}$/.test(uid) ? 'UIDs are 6–12 digits' : null);

export default function RegisterSquadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading } = useTournament(id);
  const mySquad = useMySquad(id);
  const register = useRegisterSquad(id);
  const t = data?.tournament;

  const [squadName, setSquadName] = useState('');
  const [captainName, setCaptainName] = useState(user?.displayName ?? '');
  const [captainUid, setCaptainUid] = useState('');
  const [mates, setMates] = useState<Mate[]>([emptyMate(), emptyMate(), emptyMate()]);
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // One key per attempt; kept only when retrying after a network failure.
  const keyRef = useRef(newIdempotencyKey());

  if (isLoading || mySquad.isLoading) {
    return (
      <Screen header={<ScreenHeader title="Register squad" variant="close" />} bottomInset>
        <ActivityIndicator color={Colors.primary} style={styles.loading} />
      </Screen>
    );
  }
  if (!t || !isRegistrationOpen(t) || mySquad.data) {
    return (
      <Screen header={<ScreenHeader title="Register squad" variant="close" />} bottomInset>
        <EmptyState
          icon={mySquad.data ? 'checkmark-circle' : 'lock-closed'}
          title={mySquad.data ? `You're in ${mySquad.data.name}` : 'Registration closed'}
          message={
            mySquad.data
              ? 'You can only be in one squad per tournament.'
              : 'This tournament is full, closed or no longer available.'
          }
          actionLabel="Back to the tournament"
          onAction={() =>
            t
              ? router.replace({ pathname: '/tournament/[id]', params: { id: t.id } })
              : router.replace('/')
          }
        />
      </Screen>
    );
  }

  const mateCount = t.teamSize - 1;
  const activeMates = mates.slice(0, mateCount);
  const myDigits = user?.phone.replace('+91', '') ?? '';
  const conflictPositions =
    register.error instanceof ApiError
      ? ((register.error.details?.positions as number[] | undefined) ?? [])
      : [];

  const mateErrors = activeMates.map((m, i) => {
    const others = activeMates.filter((_, j) => j !== i).map((o) => o.phone);
    const phoneProblem =
      phoneError(m.phone) ??
      (m.phone === myDigits
        ? 'That’s your own number'
        : others.includes(m.phone)
          ? 'Each member needs a different number'
          : null) ??
      (conflictPositions.includes(i + 2) ? 'Already registered in this tournament' : null);
    return { name: nameError(m.name), phone: phoneProblem, uid: uidError(m.uid) };
  });
  const squadNameError = squadName.trim().length < 2 ? 'Give your squad a name' : null;
  const valid =
    !squadNameError &&
    !nameError(captainName) &&
    !uidError(captainUid) &&
    mateErrors.every((e) => !e.name && !e.phone && !e.uid) &&
    consent;

  const updateMate = (index: number, patch: Partial<Mate>) => {
    setMates((current) => current.map((m, i) => (i === index ? { ...m, ...patch } : m)));
    register.reset();
  };

  const submit = () => {
    setSubmitted(true);
    if (!valid) {
      haptics.warning();
      return;
    }
    register.mutate(
      {
        key: keyRef.current,
        body: {
          squadName: squadName.trim(),
          captain: { name: captainName.trim(), ...(captainUid ? { freeFireUid: captainUid } : {}) },
          teammates: activeMates.map((m) => ({
            name: m.name.trim(),
            phone: `+91${m.phone}`,
            ...(m.uid ? { freeFireUid: m.uid } : {}),
          })),
          consent: true,
        },
      },
      {
        onSuccess: () => {
          haptics.success();
          // Back to the tournament page if it is open underneath, otherwise open it.
          router.dismissTo({ pathname: '/tournament/[id]', params: { id: t.id } });
        },
        onError: (error) => {
          haptics.warning();
          if (!(error instanceof ApiError && error.status === 0))
            keyRef.current = newIdempotencyKey();
        },
      }
    );
  };

  return (
    <Screen
      header={<ScreenHeader title={`Register ${teamWord(t, 1)}`} variant="close" />}
      footer={
        <View style={styles.footer}>
          {register.isError ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} />
              <AppText variant="caption" color={Colors.danger} style={styles.flex}>
                {errorMessage(register.error)}
              </AppText>
            </View>
          ) : null}
          <Button
            title={register.isPending ? 'Registering…' : `Register ${teamWord(t, 1)}`}
            icon="checkmark-circle"
            size="lg"
            disabled={register.isPending}
            onPress={submit}
          />
        </View>
      }>
      <LinearGradient
        colors={MapStyles[t.map].gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.summary}>
        <ModeBadge mode={t.mode} onDark />
        <AppText variant="title" numberOfLines={1}>
          {t.title}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.9)">
          {MAP_LABEL[t.map]} · {formatDateTime(t.startsAt)} · Free entry · Prize pool{' '}
          {formatMoney(t.prizePool)}
        </AppText>
      </LinearGradient>

      <Card>
        <TextField
          label={`${t.mode === 'SOLO' ? 'Team' : MODE_LABEL[t.mode]} name`}
          placeholder="e.g. Team Inferno"
          value={squadName}
          onChangeText={(v) => {
            setSquadName(v);
            register.reset();
          }}
          maxLength={24}
          error={submitted ? squadNameError : null}
        />
      </Card>

      <MemberCard number={1} title="You (captain)">
        <TextField
          label="Name"
          value={captainName}
          onChangeText={setCaptainName}
          maxLength={32}
          error={submitted ? nameError(captainName) : null}
        />
        <View style={styles.verified}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.live} />
          <AppText variant="caption">
            {user ? formatPhone(user.phone) : ''} · verified at sign-in
          </AppText>
        </View>
        <TextField
          label="Free Fire UID (optional)"
          placeholder="e.g. 1234567890"
          value={captainUid}
          onChangeText={(v) => setCaptainUid(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={12}
          error={submitted ? uidError(captainUid) : null}
        />
      </MemberCard>

      {activeMates.map((mate, i) => (
        <MemberCard
          key={i}
          number={i + 2}
          title={`Teammate ${i + 1}`}
          highlight={conflictPositions.includes(i + 2)}>
          <TextField
            label="Name"
            placeholder="Their name"
            value={mate.name}
            onChangeText={(v) => updateMate(i, { name: v })}
            maxLength={32}
            error={submitted ? mateErrors[i]?.name : null}
          />
          <PhoneField
            label="Mobile number"
            value={mate.phone}
            onChangeText={(v) => updateMate(i, { phone: v })}
            error={submitted || conflictPositions.includes(i + 2) ? mateErrors[i]?.phone : null}
          />
          <TextField
            label="Free Fire UID (optional)"
            placeholder="e.g. 1234567890"
            value={mate.uid}
            onChangeText={(v) => updateMate(i, { uid: v.replace(/\D/g, '') })}
            keyboardType="number-pad"
            maxLength={12}
            error={submitted ? mateErrors[i]?.uid : null}
          />
        </MemberCard>
      ))}

      <Checkbox
        checked={consent}
        onChange={setConsent}
        label="My teammates are 18 or older and agreed to share their name and mobile number with Clutch Arena for this tournament."
        error={submitted && !consent}
      />

      <View style={styles.privacy}>
        <Ionicons name="lock-closed" size={14} color={Colors.textFaint} />
        <AppText variant="caption" color={Colors.textFaint} style={styles.flex}>
          Only you (the captain) and the organizer can see these numbers. Other players see just
          your squad name. Teammates can sign in with their own number to see the room details. Read
          our <LegalLink doc="privacy">Privacy Policy</LegalLink>.
        </AppText>
      </View>
    </Screen>
  );
}

function MemberCard({
  number,
  title,
  highlight,
  children,
}: {
  number: number;
  title: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <Card style={highlight ? styles.highlight : undefined}>
      <View style={styles.memberHeader}>
        <View style={[styles.memberNumber, number === 1 && styles.captain]}>
          <AppText style={styles.memberNumberText}>{number}</AppText>
        </View>
        <AppText variant="heading">{title}</AppText>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    marginTop: 60,
  },
  summary: {
    borderRadius: Radius.lg,
    padding: 16,
    gap: 6,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
  },
  captain: {
    backgroundColor: Colors.primary,
  },
  memberNumberText: {
    fontWeight: '700',
    fontSize: 13,
  },
  highlight: {
    borderColor: Colors.danger,
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  privacy: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  footer: {
    gap: 10,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
