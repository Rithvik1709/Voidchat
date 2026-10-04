/** One place for the site's identity, so titles, links and structured data never disagree. */

/** The public address. Set NEXT_PUBLIC_SITE_URL if the site moves to another domain. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://nullchat.tech').replace(/\/+$/, '');

export const SITE = {
    name: 'Nullchat',
    /** How people actually type the name into a search box */
    alternateNames: ['Null Chat', 'NullChat'],
    url: SITE_URL,
    /** ≤ 60 characters so Google shows all of it */
    title: 'Nullchat: anonymous group chat, no sign-up, leaves no trace',
    /** ≤ 160 characters */
    description:
        'Free anonymous group chat with no accounts and no message history. Make an encrypted room, share a one-time link, and let messages burn away.',
    tagline: 'Anonymous group chat that leaves no trace.',
    keywords: [
        'anonymous group chat',
        'anonymous chat room',
        'ephemeral chat',
        'disappearing messages',
        'burn after reading chat',
        'one-time invite link',
        'chat without sign up',
        'encrypted group chat',
        'temporary chat room',
        'Nullchat',
        'Null Chat',
    ],
    locale: 'en_US',
} as const;

export const OG_ALT = `${SITE.name}: ${SITE.tagline}`;

export const absoluteUrl = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** Pages that should appear in search results and the sitemap. App screens and room links do not. */
export const INDEXABLE_PATHS = [
    { path: '/', priority: 1, changeFrequency: 'weekly' as const },
    { path: '/about', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/status', priority: 0.3, changeFrequency: 'daily' as const },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
];

/** Never crawled: private rooms, the API, the admin area. */
export const BLOCKED_PATHS = ['/api/', '/admin', '/chat/'];
