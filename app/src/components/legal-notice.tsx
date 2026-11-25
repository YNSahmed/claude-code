import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';
import type { LegalDocId } from '@/legal/documents';

import { AppText } from './ui/app-text';

/** An inline link to a legal page, for use inside a sentence. */
export function LegalLink({ doc, children }: { doc: LegalDocId; children: string }) {
  return (
    <Link href={{ pathname: '/legal/[doc]', params: { doc } }} style={styles.link}>
      {children}
    </Link>
  );
}

/** "By continuing, you agree to our Terms of Service and Privacy Policy." */
export function AgreementNotice({ action = 'continuing' }: { action?: string }) {
  return (
    <AppText variant="caption" color={Colors.textMuted}>
      By {action}, you agree to our <LegalLink doc="terms">Terms of Service</LegalLink> and confirm
      you have read our <LegalLink doc="privacy">Privacy Policy</LegalLink>.
    </AppText>
  );
}

const styles = StyleSheet.create({
  link: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});
