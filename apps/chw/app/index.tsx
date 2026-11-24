import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const helloImage = require('../assets/images/hello.webp');

export default function HelloScreen() {
  const { t, i18n } = useTranslation();
  const nextLanguage = i18n.language === 'fr' ? 'en' : 'fr';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="pb-10">
        <Image
          source={helloImage}
          accessibilityLabel={t('mobile.chw.imageAlt')}
          contentFit="cover"
          style={{ width: '100%', aspectRatio: 3 / 2 }}
        />
        <View className="gap-4 px-6 pt-6">
          <Text className="text-sm font-semibold uppercase tracking-widest text-brand-700">
            {t('common.appName')}
          </Text>
          <Text accessibilityRole="header" className="text-3xl font-bold text-ink-900">
            {t('mobile.chw.title')}
          </Text>
          <Text className="text-lg leading-7 text-ink-600">{t('mobile.chw.body')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void i18n.changeLanguage(nextLanguage)}
            className="mt-4 min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 active:bg-brand-700"
          >
            <Text className="text-base font-semibold text-white">{t('mobile.switchLanguage')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
