import type { Metadata } from 'next';
import { OG_ALT, SITE, absoluteUrl } from './site';

type Faq = readonly { readonly q: string; readonly a: string }[];

/** Rich-result markup for the FAQ on the home page. */
export function buildFaqJsonLd(faq: Faq) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map(item => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
    };
}

/**
 * Tells search engines the site's name and the other ways people spell it ("Null Chat", "NullChat"),
 * which helps queries that are not the exact brand spelling.
 */
export function buildWebSiteJsonLd() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE.name,
        alternateName: [...SITE.alternateNames],
        url: absoluteUrl('/'),
        description: SITE.description,
        inLanguage: 'en',
    };
}

/** Describes the product itself: a free, browser-based communication app. */
export function buildWebAppJsonLd() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: SITE.name,
        alternateName: [...SITE.alternateNames],
        url: absoluteUrl('/'),
        description: SITE.description,
        applicationCategory: 'CommunicationApplication',
        operatingSystem: 'Any (runs in a web browser)',
        browserRequirements: 'Requires JavaScript and a modern browser',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
            'No account or sign-up',
            'End-to-end encrypted group rooms',
            'One-time invite links that burn after a single use',
            'Burn mode: messages disappear after a set time',
            'Optional room password, member limit and auto-close timer',
            'Image and voice messages, polls and replies',
        ],
    };
}

/** JSON for a <script type="application/ld+json"> tag, safe to embed in HTML. */
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

/**
 * The full set of search and share tags for one page. Every page that is meant to be found goes
 * through this, so its canonical address, og:url and share image always agree and a page's own
 * tags can never accidentally wipe out the defaults.
 */
export function buildPageMetadata({
    title,
    description,
    path,
    absoluteTitle = false,
}: {
    title: string;
    description: string;
    path: string;
    /** true = use the title exactly as given (the home page), false = "<title> | Nullchat" */
    absoluteTitle?: boolean;
}): Metadata {
    const shareTitle = absoluteTitle ? title : `${title} | ${SITE.name}`;
    return {
        title: absoluteTitle ? { absolute: title } : title,
        description,
        alternates: { canonical: path },
        openGraph: {
            type: 'website',
            siteName: SITE.name,
            locale: SITE.locale,
            url: path,
            title: shareTitle,
            description,
            images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: OG_ALT }],
        },
        twitter: {
            card: 'summary_large_image',
            title: shareTitle,
            description,
            images: ['/twitter-image'],
        },
    };
}
