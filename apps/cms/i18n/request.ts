import { getRequestConfig } from 'next-intl/server';

const supportedLocales = ['en', 'es'] as const;
type SupportedLocale = (typeof supportedLocales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
    // Read the locale from the middleware (URL segment)
    const requested = await requestLocale;
    const locale: SupportedLocale = supportedLocales.includes(requested as SupportedLocale)
        ? (requested as SupportedLocale)
        : 'en';

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default
    };
});
