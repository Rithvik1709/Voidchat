import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import manifest from '@/app/manifest';
import { BLOCKED_PATHS, INDEXABLE_PATHS, SITE, SITE_URL, absoluteUrl } from '@/lib/site';
import { buildFaqJsonLd, buildPageMetadata, buildWebAppJsonLd, buildWebSiteJsonLd, serializeJsonLd } from '@/lib/seo';
import { FAQ, USE_CASES } from '@/lib/siteContent';

describe('title and description (what Google shows)', () => {
  it('fit the space search results give them', () => {
    expect(SITE.title.length).toBeLessThanOrEqual(60);
    expect(SITE.description.length).toBeGreaterThanOrEqual(70);
    expect(SITE.description.length).toBeLessThanOrEqual(160);
  });

  it('say what the product is, not just its name', () => {
    expect(SITE.title.toLowerCase()).toMatch(/anonymous/);
    expect(SITE.title.toLowerCase()).toMatch(/chat/);
    expect(SITE.description.toLowerCase()).toMatch(/anonymous|no accounts/);
  });

  it('cover how people really spell the name', () => {
    expect(SITE.alternateNames).toContain('Null Chat');
    expect(SITE.alternateNames).toContain('NullChat');
  });
});

describe('absoluteUrl', () => {
  it('builds absolute addresses with no double slashes', () => {
    expect(absoluteUrl('/about')).toBe(`${SITE_URL}/about`);
    expect(absoluteUrl('about')).toBe(`${SITE_URL}/about`);
    expect(absoluteUrl('/')).toBe(`${SITE_URL}/`);
    expect(SITE_URL).not.toMatch(/\/$/);
    expect(SITE_URL).toMatch(/^https:\/\//);
  });
});

describe('sitemap', () => {
  const entries = sitemap();

  it('lists every public page once, as absolute addresses', () => {
    expect(entries.map(e => e.url)).toEqual(INDEXABLE_PATHS.map(p => absoluteUrl(p.path)));
    expect(new Set(entries.map(e => e.url)).size).toBe(entries.length);
    entries.forEach(e => expect(e.url).toMatch(/^https:\/\//));
  });

  it('puts the home page first and most important', () => {
    expect(entries[0].url).toBe(absoluteUrl('/'));
    expect(entries[0].priority).toBe(1);
    expect(Math.max(...entries.map(e => e.priority ?? 0))).toBe(1);
  });

  it('never includes private or app-only addresses', () => {
    for (const e of entries) {
      for (const blocked of [...BLOCKED_PATHS, '/groups']) expect(e.url).not.toContain(blocked);
    }
  });
});

describe('robots.txt', () => {
  const r = robots();
  const rule = (Array.isArray(r.rules) ? r.rules[0] : r.rules) as { userAgent: string; allow: string; disallow: string[] };

  it('lets crawlers in, but keeps them out of rooms, the API and admin', () => {
    expect(rule.userAgent).toBe('*');
    expect(rule.allow).toBe('/');
    expect(rule.disallow).toEqual(expect.arrayContaining(['/api/', '/admin', '/chat/']));
  });

  it('does not block pages that should be found', () => {
    for (const { path } of INDEXABLE_PATHS) {
      const hit = rule.disallow.some(d => path !== '/' && path.startsWith(d));
      expect(hit, path).toBe(false);
    }
    expect(rule.disallow).not.toContain('/');
  });

  it('points at the sitemap', () => {
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe('structured data', () => {
  it('FAQ markup matches the FAQ on the page, question for question', () => {
    const data = buildFaqJsonLd(FAQ);
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(FAQ.length);
    data.mainEntity.forEach((q, i) => {
      expect(q.name).toBe(FAQ[i].q);
      expect(q.acceptedAnswer.text).toBe(FAQ[i].a);
    });
  });

  it('WebSite markup names the site and its alternate spellings', () => {
    const data = buildWebSiteJsonLd();
    expect(data.name).toBe('Nullchat');
    expect(data.alternateName).toEqual(expect.arrayContaining(['Null Chat', 'NullChat']));
    expect(data.url).toBe(absoluteUrl('/'));
  });

  it('WebApplication markup describes a free browser app', () => {
    const data = buildWebAppJsonLd();
    expect(data.applicationCategory).toBe('CommunicationApplication');
    expect(data.isAccessibleForFree).toBe(true);
    expect(data.offers.price).toBe('0');
    expect(data.featureList.length).toBeGreaterThan(3);
  });

  it('is safe to embed in HTML: a closing script tag cannot escape it', () => {
    const out = serializeJsonLd({ a: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(JSON.parse(out).a).toBe('</script><script>alert(1)</script>'); // still the same data once parsed
  });

  it('content used for markup has no empty entries', () => {
    [...FAQ.flatMap(f => [f.q, f.a]), ...USE_CASES.flatMap(u => [u.title, u.body])].forEach(t => expect(t.trim().length).toBeGreaterThan(10));
  });
});

describe('web app manifest', () => {
  it('names the app and provides the icon sizes browsers ask for', () => {
    const m = manifest();
    expect(m.name).toBe('Nullchat');
    expect(m.start_url).toBe('/groups');
    expect(m.icons?.map(i => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });
});

describe('buildPageMetadata (every findable page goes through it)', () => {
  const meta = buildPageMetadata({ title: 'About', description: 'About this site and how it works.', path: '/about' });
  const og = meta.openGraph as { url: string; title: string; images: { url: string; width: number; height: number }[] };
  const tw = meta.twitter as { card: string; title: string; images: string[] };

  it('gives the page its own canonical address and og:url, and they agree', () => {
    expect(meta.alternates?.canonical).toBe('/about');
    expect(og.url).toBe('/about');
  });

  it('adds the brand to the title once, in the tab and in share cards', () => {
    expect(meta.title).toBe('About');
    expect(og.title).toBe('About | Nullchat');
    expect(tw.title).toBe('About | Nullchat');
  });

  it('always carries the share image, so a page can never lose it', () => {
    expect(og.images[0]).toMatchObject({ url: '/opengraph-image', width: 1200, height: 630 });
    expect(tw.card).toBe('summary_large_image');
    expect(tw.images).toEqual(['/twitter-image']);
  });

  it('uses the title exactly as given when asked (home page)', () => {
    const home = buildPageMetadata({ title: SITE.title, description: SITE.description, path: '/', absoluteTitle: true });
    expect(home.title).toEqual({ absolute: SITE.title });
    expect((home.openGraph as { title: string }).title).toBe(SITE.title);
    expect(home.alternates?.canonical).toBe('/');
  });
});
