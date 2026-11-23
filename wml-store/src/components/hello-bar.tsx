import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type TextStyle } from 'react-native';

import { Fonts } from '@/constants/theme';

import { ThemedText } from './themed-text';

export const HELLO_BAR_CONTENT_HEIGHT = 60;

type HelloBarItem = {
  text: string;
  action?: unknown;
  [key: string]: unknown;
};

type Props = {
  data: Record<string, unknown>;
  topInset?: number;
  onLayout?: (height: number) => void;
  onAction?: (action: unknown) => void;
};

type CountdownValue = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type MarkdownSegment = {
  text: string;
  bold: boolean;
  italic: boolean;
};

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.trim().toLowerCase() === 'true') return true;
    if (value.trim().toLowerCase() === 'false') return false;
  }
  return fallback;
}

function numberValue(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function colorValue(value: unknown, fallback: string) {
  const color = stringValue(value);
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) ? color : fallback;
}

function parseItems(value: unknown): HelloBarItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [{ text: item.trim() }];
    const source = record(item);
    if (!source) return [];
    const message = stringValue(source.text) || stringValue(source.message) || stringValue(source.label);
    return message ? [{ ...source, text: message }] : [];
  });
}

function parseInlineMarkdown(value: string): MarkdownSegment[] {
  const pattern = /(\*\*\*|___)(.+?)\1|(\*\*|__)(.+?)\3|(\*|_)(.+?)\5/g;
  const segments: MarkdownSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ text: value.slice(lastIndex, start), bold: false, italic: false });
    }

    const delimiter = match[1] || match[3] || match[5] || '';
    const content = match[2] || match[4] || match[6] || '';
    segments.push({
      text: content,
      bold: delimiter.length > 1,
      italic: delimiter.length === 1 || delimiter.length === 3,
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({ text: value.slice(lastIndex), bold: false, italic: false });
  }

  return segments.length > 0 ? segments : [{ text: value, bold: false, italic: false }];
}

function parseTargetDate(value: unknown) {
  const source = stringValue(value);
  if (!source) return null;
  const timestamp = new Date(source).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function countdownValue(target: number, now: number): CountdownValue {
  const remainingSeconds = Math.max(0, Math.floor((target - now) / 1000));
  return {
    days: Math.floor(remainingSeconds / 86_400),
    hours: Math.floor((remainingSeconds % 86_400) / 3_600),
    minutes: Math.floor((remainingSeconds % 3_600) / 60),
    seconds: remainingSeconds % 60,
  };
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function HelloBar({
  data,
  topInset = 0,
  onLayout,
  onAction,
}: Props) {
  const items = parseItems(data.items);
  const [activeIndex, setActiveIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const enabled = booleanValue(data.enabled, true);
  const autoplay = booleanValue(data.autoplay, true);
  const autoplayInterval = numberValue(data.autoplayIntervalSeconds, 5, 2, 30) * 1000;
  const showNavigationArrows = booleanValue(data.showNavigationArrows, true) && items.length > 1;
  const activeItem = items[activeIndex % Math.max(items.length, 1)];
  const showButton = booleanValue(activeItem?.showButton, booleanValue(data.showButton, false));
  const buttonLabel = stringValue(activeItem?.buttonLabel)
    || stringValue(activeItem?.ctaText)
    || stringValue(data.buttonLabel)
    || stringValue(data.ctaText)
    || 'COMPRAR';
  const buttonAction = activeItem?.buttonAction ?? data.buttonAction ?? data.action ?? activeItem?.action;
  const targetDate = parseTargetDate(activeItem?.countdownEndDate)
    ?? parseTargetDate(activeItem?.endDate)
    ?? parseTargetDate(data.countdownEndDate)
    ?? parseTargetDate(data.endDate);
  const showCountdown = booleanValue(activeItem?.showCountdown, booleanValue(data.showCountdown, false)) && targetDate !== null;
  const countdown = showCountdown && targetDate !== null ? countdownValue(targetDate, now) : null;
  const countdownExpired = countdown !== null && targetDate !== null && targetDate <= now;
  const hideWhenExpired = booleanValue(
    activeItem?.hideWhenCountdownExpires,
    booleanValue(data.hideWhenCountdownExpires, false),
  );
  const expiredText = stringValue(activeItem?.countdownExpiredText) || stringValue(data.countdownExpiredText);
  const backgroundColor = colorValue(data.backgroundColor, '#000000');
  const textColor = colorValue(data.textColor, '#FFFFFF');
  const boldTextColor = colorValue(activeItem?.boldTextColor, textColor);
  const italicTextColor = colorValue(activeItem?.italicTextColor, textColor);
  const buttonBackgroundColor = colorValue(data.buttonBackgroundColor, '#FFFFFF');
  const buttonTextColor = colorValue(data.buttonTextColor, '#000000');
  const messageSegments = parseInlineMarkdown(activeItem?.text ?? '');
  useEffect(() => {
    if (!enabled || !autoplay || items.length < 2) return;
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, autoplayInterval);
    return () => clearInterval(timer);
  }, [autoplay, autoplayInterval, enabled, items.length]);

  useEffect(() => {
    if (!enabled || !showCountdown || targetDate === null || targetDate <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= targetDate) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [enabled, showCountdown, targetDate]);

  const handleLayout = (event: LayoutChangeEvent) => {
    onLayout?.(event.nativeEvent.layout.height);
  };

  if (!enabled || items.length === 0 || (countdownExpired && hideWhenExpired)) {
    return <View onLayout={handleLayout} style={styles.hiddenContainer} />;
  }

  const hasAction = (action: unknown) => {
    const source = record(action);
    return Boolean(stringValue(source?.type) && stringValue(source?.type) !== 'none' && stringValue(source?.value));
  };
  const effectiveButtonAction = hasAction(buttonAction) ? buttonAction : activeItem?.action;

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        { backgroundColor, paddingTop: topInset, minHeight: HELLO_BAR_CONTENT_HEIGHT + topInset },
      ]}>
      {showNavigationArrows && (
        <>
          <Pressable
            accessibilityLabel="Oferta anterior"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setActiveIndex((current) => (current - 1 + items.length) % items.length)}
            style={[styles.arrow, { top: topInset }, styles.leftArrow]}>
            <ThemedText style={[styles.arrowText, { color: textColor }]}>‹</ThemedText>
          </Pressable>
          <Pressable
            accessibilityLabel="Próxima oferta"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setActiveIndex((current) => (current + 1) % items.length)}
            style={[styles.arrow, { top: topInset }, styles.rightArrow]}>
            <ThemedText style={[styles.arrowText, { color: textColor }]}>›</ThemedText>
          </Pressable>
        </>
      )}

      <View style={[styles.content, showNavigationArrows && styles.contentWithArrows]}>
        <Pressable
          accessibilityRole={hasAction(activeItem?.action) ? 'link' : undefined}
          disabled={!hasAction(activeItem?.action)}
          onPress={() => onAction?.(activeItem?.action)}
          style={styles.messageTarget}>
          <ThemedText numberOfLines={2} style={[styles.message, { color: textColor }]}>
            {messageSegments.map((segment, segmentIndex) => {
              const inlineStyle: TextStyle = {
                ...(segment.bold ? { fontFamily: Fonts.bold, fontWeight: '700' } : {}),
                ...(segment.italic ? { fontStyle: 'italic' } : {}),
                ...(segment.bold ? { color: boldTextColor } : segment.italic ? { color: italicTextColor } : {}),
              };
              return <Text key={String(segmentIndex)} style={inlineStyle}>{segment.text}</Text>;
            })}
          </ThemedText>
        </Pressable>

        <View style={styles.offerRow}>
          {countdown && !countdownExpired && (
            <View style={styles.timer} accessibilityLabel="Contagem regressiva da oferta">
              <CountdownUnit value={pad(countdown.days)} label={stringValue(activeItem?.daysLabel) || stringValue(data.daysLabel) || 'Dias'} textColor={textColor} />
              <TimerSeparator textColor={textColor} />
              <CountdownUnit value={pad(countdown.hours)} label={stringValue(activeItem?.hoursLabel) || stringValue(data.hoursLabel) || 'Horas'} textColor={textColor} />
              <TimerSeparator textColor={textColor} />
              <CountdownUnit value={pad(countdown.minutes)} label={stringValue(activeItem?.minutesLabel) || stringValue(data.minutesLabel) || 'Minutos'} textColor={textColor} />
              <TimerSeparator textColor={textColor} />
              <CountdownUnit value={pad(countdown.seconds)} label={stringValue(activeItem?.secondsLabel) || stringValue(data.secondsLabel) || 'Segundos'} textColor={textColor} />
            </View>
          )}

          {countdownExpired && !!expiredText && (
            <ThemedText numberOfLines={1} style={[styles.expiredText, { color: textColor }]}>{expiredText}</ThemedText>
          )}

          {showButton && !!buttonLabel && (
            <Pressable
              accessibilityRole={hasAction(effectiveButtonAction) ? 'link' : 'button'}
              disabled={!hasAction(effectiveButtonAction)}
              onPress={() => onAction?.(effectiveButtonAction)}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: buttonBackgroundColor },
                pressed && styles.pressed,
              ]}>
              <ThemedText numberOfLines={1} style={[styles.buttonText, { color: buttonTextColor }]}>{buttonLabel}</ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function CountdownUnit({ value, label, textColor }: { value: string; label: string; textColor: string }) {
  return (
    <View style={styles.unit}>
      <ThemedText style={[styles.unitValue, { color: textColor }]}>{value}</ThemedText>
      <ThemedText numberOfLines={1} style={[styles.unitLabel, { color: textColor }]}>{label}</ThemedText>
    </View>
  );
}

function TimerSeparator({ textColor }: { textColor: string }) {
  return <ThemedText style={[styles.separator, { color: textColor }]}>:</ThemedText>;
}

const styles = StyleSheet.create({
  hiddenContainer: { width: '100%', height: 0 },
  container: {
    width: '100%',
    justifyContent: 'center',
  },
  arrow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 1,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftArrow: { left: 5 },
  rightArrow: { right: 5 },
  arrowText: {
    fontFamily: Fonts.light,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '300',
  },
  content: {
    minHeight: HELLO_BAR_CONTENT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 2,
  },
  contentWithArrows: {
    paddingLeft: 36,
    paddingRight: 36,
  },
  messageTarget: {
    width: '100%',
    alignItems: 'center',
  },
  message: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
    textAlign: 'center',
  },
  offerRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 2,
  },
  unit: {
    minWidth: 24,
    alignItems: 'center',
  },
  unitValue: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    maxWidth: 39,
    fontFamily: Fonts.medium,
    fontSize: 6,
    lineHeight: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  separator: {
    marginTop: -1,
    fontFamily: Fonts.light,
    fontSize: 16,
    lineHeight: 18,
  },
  expiredText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
  },
  button: {
    minWidth: 82,
    height: 26,
    paddingHorizontal: 14,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: Fonts.semibold,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  pressed: { opacity: 0.72 },
});
