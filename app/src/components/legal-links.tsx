import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { BUSINESS } from '@/constants/business';
import { LEGAL_DOC_ORDER, LEGAL_DOCS } from '@/legal/documents';

import { AppText } from './ui/app-text';

/**
 * The app's "footer": links to every legal page. Shown on the sign-in screen, the Profile tab and
 * at the end of each legal page. The pages also work as public web addresses (/legal/privacy, …).
 */
export function LegalLinks() {
  return (
    <View style={styles.wrapper} accessibilityRole="none">
      <View style={styles.row}>
        {LEGAL_DOC_ORDER.map((id, i) => (
          <View key={id} style={styles.item}>
            {i > 0 ? (
              <AppText
                variant="caption"
                color={Colors.textMuted}
                importantForAccessibility="no"
                accessibilityElementsHidden>
                ·
              </AppText>
            ) : null}
            <Link
              href={{ pathname: '/legal/[doc]', params: { doc: id } }}
              accessibilityRole="link"
              style={styles.link}>
              {LEGAL_DOCS[id].linkLabel}
            </Link>
          </View>
        ))}
      </View>
      <AppText variant="caption" color={Colors.textMuted} style={styles.center}>
        © {BUSINESS.name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  link: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: 'underline',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  center: {
    textAlign: 'center',
  },
});
