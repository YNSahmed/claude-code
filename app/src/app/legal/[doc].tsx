import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { LegalLinks } from '@/components/legal-links';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { LEGAL_PAGES_ARE_DRAFTS } from '@/constants/business';
import { Colors, Radius } from '@/constants/theme';
import { isLegalDocId, LEGAL_DOCS, type LegalBlock } from '@/legal/documents';

/** Highlights [blanks] so they are easy to find while the pages are drafts. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <AppText style={styles.paragraph}>
      {parts.map((part, i) =>
        part.startsWith('[') && part.endsWith(']') ? (
          <AppText key={i} style={styles.blank}>
            {part}
          </AppText>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </AppText>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') return <Rich text={block} />;
  return (
    <View style={styles.list}>
      {block.bullets.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <AppText style={styles.bullet} importantForAccessibility="no" accessibilityElementsHidden>
            •
          </AppText>
          <View style={styles.flex}>
            <Rich text={item} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Privacy policy, terms, refund policy and cookie policy. Open to everyone, signed in or not. */
export default function LegalPage() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const router = useRouter();

  if (!isLegalDocId(doc)) {
    return (
      <Screen header={<ScreenHeader title="Legal" />} bottomInset>
        <EmptyState
          icon="document-text-outline"
          title="Page not found"
          message="This legal page doesn't exist."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const page = LEGAL_DOCS[doc];
  return (
    <Screen header={<ScreenHeader title={page.title} />} bottomInset>
      {LEGAL_PAGES_ARE_DRAFTS ? (
        <View style={styles.draft} accessibilityRole="alert">
          <Ionicons
            name="construct-outline"
            size={18}
            color={Colors.gold}
            importantForAccessibility="no"
            accessibilityElementsHidden
          />
          <AppText variant="caption" color={Colors.text} style={styles.flex}>
            <AppText style={styles.draftLabel}>DRAFT. </AppText>
            Not yet reviewed or in force. Highlighted text in [brackets] still needs to be filled in
            or confirmed.
          </AppText>
        </View>
      ) : null}

      <AppText variant="title" accessibilityRole="header">
        {page.title}
      </AppText>
      <Rich text={page.intro} />

      {page.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {section.heading}
          </AppText>
          {section.body.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </View>
      ))}

      <LegalLinks />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  draft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(255, 194, 61, 0.08)',
  },
  draftLabel: {
    fontWeight: '800',
    color: Colors.gold,
    fontSize: 13,
  },
  section: {
    gap: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 23,
    color: Colors.text,
  },
  blank: {
    color: Colors.gold,
    fontWeight: '700',
  },
  list: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    color: Colors.primary,
    fontSize: 15,
    lineHeight: 23,
  },
});
