export type CaledoraModule = 'hub' | 'airways' | 'bank' | 'instagram' | 'twitter';

type FaviconDefinition = {
  href: string;
  type: string;
};

const AIRWAYS_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0c4a6e"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#g)"/><circle cx="47" cy="17" r="8" fill="#fbbf24"/><path d="M11 36.5 28 31l17-17 4 2-10 19 11 8-2.5 3-14-5-13 7-3-2 8-9-13 2z" fill="#fff"/></svg>`;
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
  twitter: asset('images/XLogo.png', 'image/png'),
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