import { CartIconButton } from '@/components/cart-icon-button';
import { AssistantHeaderButton } from '@/components/assistant-header-button';
import { CmsSectionView } from '@/components/cms-section';
import { HomeSkeleton } from '@/components/home-skeleton';
import { HELLO_BAR_CONTENT_HEIGHT, isHelloBarVisible } from '@/components/hello-bar';
import HopeLogoIcon from '@/components/icons/HopeLogoIcon';
import SearchIcon from '@/components/icons/SearchIcon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { PageThemeProvider, usePageTheme } from '@/context/page-theme-context';
import { TabBarContext } from '@/context/tab-bar-context';
import { useTheme } from '@/hooks/use-theme';
import { getCmsPage, type CmsPage, type CmsSection } from '@/services/cms';
import { resolvePageTheme, resolvePageThemeColors } from '@/services/cms-page-theme';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const NON_HERO_BANNER_MODES = new Set([
  'SingleBanner',
  'BannerList',
  'RoundedBannerList',
  'GridList',
  'FitOnScreen',
  'carousel',
  'scroll',
]);

function isHeroBannerMode(mode: string) {
  return !NON_HERO_BANNER_MODES.has(mode.trim());
}

function isCmsSectionVisible(section: CmsSection) {
  const data = section.data ?? {};
  if (section.name === 'CategoryBackground' || section.name === 'BottomTabSettings') return false;
  if (section.name === 'HelloBar') return isHelloBarVisible(data);
  if (section.name === 'MultipleImageBanner') return Array.isArray(data.images) && data.images.length > 0;
  return true;
}

function isHeroSection(section?: CmsSection) {
  if (section?.name !== 'MultipleImageBanner') return false;
  const mode = typeof section.data?.mode === 'string' ? section.data.mode.trim() : '';
  return isHeroBannerMode(mode);
}

export default function HomeScreen() {
  const [cmsPage, setCmsPage] = useState<CmsPage | null>(null);
  const [cmsLoading, setCmsLoading] = useState(true);
  const [cmsError, setCmsError] = useState(false);

  useEffect(() => {
    let active = true;
    getCmsPage('home', 'home', {
      onRefresh: (page) => {
        if (active) setCmsPage(page);
      },
    })
      .then((page) => { if (active) setCmsPage(page); })
      .catch(() => { if (active) setCmsError(true); })
      .finally(() => { if (active) setCmsLoading(false); });

    return () => {
      active = false;
    };
  }, []);

  const pageTheme = resolvePageTheme(cmsPage);
  const customColors = resolvePageThemeColors(cmsPage);

  return (
    <PageThemeProvider theme={pageTheme} customColors={customColors}>
      <HomeScreenContent cmsPage={cmsPage} cmsLoading={cmsLoading} cmsError={cmsError} />
    </PageThemeProvider>
  );
}

function HomeScreenContent({ cmsPage, cmsLoading, cmsError }: { cmsPage: CmsPage | null; cmsLoading: boolean; cmsError: boolean }) {
  const router = useRouter();
  const { setHidden } = useContext(TabBarContext);
  const lastScrollY = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const pageTheme = usePageTheme();
  const theme = useTheme();
  const dark = pageTheme.isDark;
  const [scrollY, setScrollY] = useState(0);
  const [helloBarHeight, setHelloBarHeight] = useState<number | null>(null);
  const sections = cmsPage?.sections ?? [];
  const visibleSections = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => isCmsSectionVisible(section));
  const firstVisibleSectionIndex = visibleSections[0]?.index ?? -1;
  const firstVisibleSection = visibleSections[0]?.section;
  const firstSectionHelloBarIsVisible = firstVisibleSection?.name === 'HelloBar';
  const firstSectionIsHero = isHeroSection(firstVisibleSection);
  const sectionBehindHelloBar = visibleSections[1]?.section;
  const sectionBehindHelloBarIndex = visibleSections[1]?.index ?? -1;
  const hasHeroBehindHelloBar = firstSectionHelloBarIsVisible
    && isHeroSection(sectionBehindHelloBar);
  const measuredHelloBarHeight = helloBarHeight ?? HELLO_BAR_CONTENT_HEIGHT + insets.top;
  const headerTop = firstSectionHelloBarIsVisible ? Math.max(0, measuredHelloBarHeight - scrollY) : 0;
  const headerPaddingTop = firstSectionHelloBarIsVisible ? Math.max(0, insets.top - headerTop) : insets.top;
  const hasOverlayHeader = firstSectionIsHero || firstSectionHelloBarIsVisible;
  const transparentHeader = hasOverlayHeader && scrollY <= 8;
  const headerForegroundColor = transparentHeader ? '#FFFFFF' : hasOverlayHeader ? '#000000' : theme.text;

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        {(firstSectionHelloBarIsVisible || firstSectionIsHero) && (
          <StatusBar
            style={transparentHeader || (firstSectionHelloBarIsVisible && scrollY < measuredHelloBarHeight) ? 'light' : 'dark'}
          />
        )}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            firstSectionHelloBarIsVisible ? styles.helloBarContent : firstSectionIsHero ? styles.heroContent : styles.content,
            { backgroundColor: theme.background },
          ]}
          scrollEventThrottle={16}
          onScroll={(event) => {
            const currentY = event.nativeEvent.contentOffset.y;
            setScrollY(currentY);
            if (currentY <= 8) setHidden(false);
            else if (currentY > lastScrollY.current + 4) setHidden(true);
            else if (currentY < lastScrollY.current - 4) setHidden(false);
            lastScrollY.current = currentY;
          }}>
          {cmsLoading && !cmsPage && <HomeSkeleton />}
          {cmsError && <ThemedText style={styles.errorText}>Nao foi possivel consultar o CMS agora.</ThemedText>}
          {!cmsLoading && !cmsError && cmsPage?.sections.length === 0 && <ThemedText themeColor="textSecondary">Nenhuma secao publicada foi encontrada.</ThemedText>}
          {sections.map((section, index) => {
            if (!isCmsSectionVisible(section)) return null;

            const overlayHelloBar = hasHeroBehindHelloBar && index === firstVisibleSectionIndex;
            const moveHeroBehindHelloBar = hasHeroBehindHelloBar && index === sectionBehindHelloBarIndex;

            return (
              <View
                key={section.name + '-' + index}
                pointerEvents={overlayHelloBar ? 'box-none' : 'auto'}
                style={[
                  overlayHelloBar && styles.helloBarOverlay,
                  moveHeroBehindHelloBar && { marginTop: -measuredHelloBarHeight },
                ]}>
                <CmsSectionView
                  section={section}
                  isHome
                  helloBarTopInset={firstSectionHelloBarIsVisible && index === firstVisibleSectionIndex ? insets.top : 0}
                  onHelloBarLayout={firstSectionHelloBarIsVisible && index === firstVisibleSectionIndex ? setHelloBarHeight : undefined}
                />
              </View>
            );
          })}
        </ScrollView>
        <View style={[styles.header, { top: headerTop, paddingTop: headerPaddingTop, minHeight: 48 + headerPaddingTop }, transparentHeader ? styles.heroHeader : [styles.scrolledHeader, dark && !hasOverlayHeader && { backgroundColor: theme.background, borderBottomColor: theme.border }]]}>
          <Pressable accessibilityLabel="Voltar ao topo" onPress={() => { scrollRef.current?.scrollTo({ y: 0, animated: true }); setHidden(false); }} style={styles.brandButton}>
            <HopeLogoIcon color={headerForegroundColor} width={76} height={20} />
          </Pressable>
          <View style={styles.headerActions}>
            <AssistantHeaderButton
              color={hasOverlayHeader ? headerForegroundColor : '#FFFFFF'}
              iconBackgroundColor={hasOverlayHeader ? (transparentHeader ? '#0a0a0a' : 'transparent') : undefined}
              size={22}
              style={[styles.headerAction, dark && !transparentHeader && { backgroundColor: theme.background }, transparentHeader && (dark ? styles.blackHeroHeaderAction : styles.heroHeaderAction), styles.headerActionNoBackground]}
            />
            <Pressable onPress={() => router.push('/search')} style={[styles.headerAction, dark && !transparentHeader && { backgroundColor: theme.background }, transparentHeader && (dark ? styles.blackHeroHeaderAction : styles.heroHeaderAction), styles.headerActionNoBackground]}><SearchIcon size={23} color={headerForegroundColor} /></Pressable>
            <CartIconButton color={headerForegroundColor} style={[styles.headerAction, transparentHeader && (dark ? styles.blackHeroHeaderAction : styles.heroHeaderAction), styles.headerActionNoBackground]} />
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safeArea: { flex: 1, position: 'relative' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.four, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 20, elevation: 0 },
  heroHeader: { backgroundColor: 'transparent' },
  scrolledHeader: { borderBottomWidth: 1, borderBottomColor: '#ece8e2', backgroundColor: '#ffffff' },
  brandButton: { minWidth: 90, minHeight: 38, justifyContent: 'center' },
  brand: { fontSize: 22, fontWeight: '700' }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  headerAction: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#ffffff' },
  headerActionNoBackground: { backgroundColor: 'transparent' },
  heroHeaderAction: { backgroundColor: 'rgba(255, 255, 255, 0.62)' },
  blackHeroHeaderAction: { backgroundColor: 'rgba(0, 0, 0, 0.42)' },
  content: { gap: Spacing.three, paddingVertical: Spacing.five },
  errorText: { color: '#ed6560' },
  heroContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  helloBarContent: { gap: 0, paddingTop: 0, paddingBottom: Spacing.five },
  helloBarOverlay: { position: 'relative', zIndex: 2, elevation: 2 },
});
