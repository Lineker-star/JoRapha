import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, type TextInputProps } from 'react-native';

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      {...input}
      className="min-h-12 rounded-xl border border-ink-200 px-4 text-base text-ink-900"
    />
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 active:bg-brand-700 disabled:opacity-60"
    >
      <Text className="text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-12 items-center justify-center rounded-xl border border-ink-200 px-5"
    >
      <Text className="text-base font-medium text-ink-900">{label}</Text>
    </Pressable>
  );
}

export function Message({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      className={
        tone === 'error'
          ? 'rounded-lg bg-red-50 p-3 text-red-900'
          : 'rounded-lg bg-brand-50 p-3 text-brand-900'
      }
    >
      {children}
    </Text>
  );
}
