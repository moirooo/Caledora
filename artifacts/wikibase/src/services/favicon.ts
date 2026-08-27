export type CaledoraModule = 'hub' | 'airways' | 'bank' | 'instagram' | 'twitter';

type FaviconDefinition = {
  href: string;
  type: string;
};

const AIRWAYS_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#fff"/><path d="M37 11h15L44 32l12 7-2 4-16-4-12 10-4-2 8-12-14-2v-4l18-2z" fill="#12244d"/><circle cx="43" cy="29" r="7" fill="#d3a958"/><path d="M7 45c9-5 18-5 27 0 8 4 15 4 23 0" fill="none" stroke="#12244d" stroke-width="3" stroke-linecap="round"/><path d="M10 52c8-4 16-4 24 0 8 4 16 4 23 0" fill="none" stroke="#d3a958" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const TWITTER_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#101418"/><path d="M14 14h11l9 12 10-12h7L38 31l13 19H40L30 36 19 50h-7l15-19z" fill="#fff"/></svg>`;
const BASE_URL = import.meta.env?.BASE_URL ?? '/';

const inlineSvg = (svg: string): FaviconDefinition => ({
  href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  type: 'image/svg+xml',
});

const asset = (file: string, type: string): FaviconDefinition => ({
  href: `${BASE_URL}${file}`,
  type,
});

const FAVICONS: Record<CaledoraModule, FaviconDefinition> = {
  hub: asset('favicon.svg', 'image/svg+xml'),
  airways: inlineSvg(AIRWAYS_FAVICON),
  bank: asset('images/oriabank.png', 'image/png'),
  instagram: asset('images/Instagram.png', 'image/png'),
  twitter: inlineSvg(TWITTER_FAVICON),
};

export function moduleForPath(pathname: string): CaledoraModule {
  const path = pathname.toLowerCase();
  if (/^\/oria(?:\/|$)/.test(path)) return 'bank';
  if (/^\/instagram(?:\/|$)/.test(path)) return 'instagram';
  if (/^\/twitter(?:\/|$)/.test(path)) return 'twitter';
  if (/^\/airways(?:\/|$)/.test(path)) return 'airways';
  return 'hub';
}

export function setFavicon(module: CaledoraModule) {
  const definition = FAVICONS[module];
  let link = document.head.querySelector<HTMLLinkElement>('#caledora-favicon');

  if (!link) {
    link = document.head.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  }

  if (!link) {
    link = document.createElement('link');
    document.head.appendChild(link);
  }

  if (link.dataset.caledoraModule === module) return;

  link.id = 'caledora-favicon';
  link.rel = 'icon';
  link.type = definition.type;
  link.href = definition.href;
  link.dataset.caledoraModule = module;
}