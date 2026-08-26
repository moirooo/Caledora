export type KV = { key: string; value: string };
export type WBImage = { filename: string; caption: string; alt: string; alignment: string; size: string; missing: boolean; src?: string };
export type WBTable = { title: string; columns: string[]; rows: string[][] };
export type WBBlock =
  | { type: 'text'; content: string }
  | { type: 'list' | 'numbered'; items: string[] }
  | { type: 'image'; image: WBImage }
  | { type: 'table'; table: WBTable };
export type WBSection = { title: string; level: number; blocks: WBBlock[] };
export type WBHistory = { timestamp: string; label: string; sourceText: string };

/** One jersey kit: a name (e.g. "Domicile") and an ordered list of hex colors. */
export type WBJersey = { name: string; colors: string[] };

/** A titled sub-group of key-value fields inside the infobox. */
export type WBInfoboxSection = { title: string; fields: KV[] };

export type WikiPage = {
  id: string; title: string; subtitle: string; aliases: string[]; introduction: string;
  infobox: KV[]; infoboxImage?: WBImage; sections: WBSection[]; links: string[];
  references: KV[]; bibliography: string[]; categories: string[]; category: string;
  type: string; sourceText: string; updatedAt: string; createdAt: string;
  history: WBHistory[]; isTrashed: boolean; accentColor?: string;
  /**
   * Presentation-only replacement selected from the visual editor. Unlike
   * infoboxImage, this never rewrites the [IMAGE_INFOBOX] source block.
   */
  infoboxImageOverride?: WBImage;
  /** Conditional — only present when [MAILLOTS] is declared in the source. */
  infoboxJerseys?: WBJersey[];
  /** Conditional — only present when [INFOBOX_SECTION] blocks are declared. */
  infoboxSections?: WBInfoboxSection[];
};

/** The image shown at the top of an infobox without altering the article source. */
export function getDisplayInfoboxImage(page: Pick<WikiPage, 'infoboxImage' | 'infoboxImageOverride'>): WBImage | undefined {
  return page.infoboxImageOverride ?? page.infoboxImage;
}

const tags = new Set(['TITRE','SOUS-TITRE','ALIASES','ALIAS','INTRODUCTION','INFOBOX','IMAGE_INFOBOX','SECTION','SOUS-SECTION','SOUS-SOUS-SECTION','TEXTE','LISTE','LISTE_NUMEROTEE','IMAGE','TABLEAU','LIENS','REFERENCES','BIBLIOGRAPHIE','CATEGORIES','COULEUR','MAILLOTS','INFOBOX_SECTION']);
const lines = (text: string) => text.replace(/\r/g, '').split('\n');
const clean = (s: string) => s.trim();
const field = (arr: string[], key: string) => {
  const row = arr.find((line) => line.trim().toLowerCase().startsWith(`${key.toLowerCase()} =`));
  return row ? row.split('=').slice(1).join('=').trim() : '';
};
const fields = (arr: string[]) => arr.filter((line) => line.includes('=')).map((line) => {
  const ix = line.indexOf('=');
  return { key: line.slice(0, ix).trim(), value: line.slice(ix + 1).trim() };
});

/** Regex for the short inline image syntax inside TEXTE blocks.
 *  `[image: fichier.png | droite | Légende optionnelle]`
 *  Groups: 1=filename  2=position (opt)  3=caption (opt)
 */
const INLINE_IMG_RE = /^\[image:\s*([^|\]]+?)(?:\|\s*([^|\]]*?))?(?:\|\s*([^|\]]*?))?\]\s*$/i;

/** Split a TEXTE block's lines into a mix of text and image blocks. */
function processTexteBlock(content: string[]): WBBlock[] {
  const result: WBBlock[] = [];
  let textLines: string[] = [];

  const flushText = () => {
    const t = textLines.join('\n').trim();
    if (t) result.push({ type: 'text', content: t });
    textLines = [];
  };

  for (const line of content) {
    const m = line.match(INLINE_IMG_RE);
    if (m) {
      flushText();
      const filename = m[1].trim();
      const alignment = (m[2]?.trim() || 'droite').toLowerCase();
      const caption = m[3]?.trim() ?? '';
      result.push({ type: 'image', image: { filename, caption, alt: caption || filename, alignment, size: '300', missing: true } });
    } else {
      textLines.push(line);
    }
  }
  flushText();
  return result;
}

export function parseWikiText(sourceText: string, category = 'Non classé', type = 'Article'): WikiPage {
  const buckets: { tag: string; content: string[] }[] = [];
  let current: { tag: string; content: string[] } | null = null;
  for (const line of lines(sourceText)) {
    // Some supported French tags contain hyphens, such as SOUS-TITRE and
    // SOUS-SOUS-SECTION. Keep the parser strict to tag-shaped lines while
    // allowing those documented names.
    const match = line.match(/^\[([A-Z_-]+)\]\s*$/);
    if (match) {
      if (current) buckets.push(current);
      current = tags.has(match[1]) ? { tag: match[1], content: [] } : null;
    } else if (current) current.content.push(line);
  }
  if (current) buckets.push(current);
  const first = (tag: string) => buckets.find((b) => b.tag === tag)?.content ?? [];
  const title = clean(first('TITRE').join('\n')) || 'Page sans titre';
  const now = new Date().toISOString();
  const sections: WBSection[] = [];
  let active: WBSection | null = null;
  const imageFrom = (arr: string[]): WBImage => ({
    filename: field(arr, 'fichier'), caption: field(arr, 'légende') || field(arr, 'legende'),
    alt: field(arr, 'alt'), alignment: field(arr, 'alignement') || 'droite', size: field(arr, 'taille') || '300', missing: true,
  });
  for (const bucket of buckets) {
    const level = bucket.tag === 'SECTION' ? 2 : bucket.tag === 'SOUS-SECTION' ? 3 : bucket.tag === 'SOUS-SOUS-SECTION' ? 4 : 0;
    if (level) { active = { title: clean(bucket.content.join('\n')), level, blocks: [] }; sections.push(active); continue; }
    if (!active) continue;
    if (bucket.tag === 'TEXTE') { for (const blk of processTexteBlock(bucket.content)) active.blocks.push(blk); }
    if (bucket.tag === 'LISTE' || bucket.tag === 'LISTE_NUMEROTEE') active.blocks.push({ type: bucket.tag === 'LISTE' ? 'list' : 'numbered', items: bucket.content.map(clean).filter(Boolean) });
    if (bucket.tag === 'IMAGE') active.blocks.push({ type: 'image', image: imageFrom(bucket.content) });
    if (bucket.tag === 'TABLEAU') {
      const columns = (field(bucket.content, 'colonnes') || '').split('|').map(clean).filter(Boolean);
      const rows = bucket.content.filter((l) => l.toLowerCase().startsWith('ligne =')).map((l) => l.split('=').slice(1).join('=').split('|').map(clean));
      active.blocks.push({ type: 'table', table: { title: field(bucket.content, 'titre'), columns, rows } });
    }
  }
  const imageLines = first('IMAGE_INFOBOX');

  // ── couleur_accent inside [INFOBOX] ───────────────────────────────────────
  // Filter the directive out so it never appears as a table row, and use its
  // value as accentColor when the dedicated [COULEUR] block is absent.
  const infoboxLines = first('INFOBOX');
  const couleurAccentInline = field(infoboxLines, 'couleur_accent');
  // Parse infobox lines: lines without '=' become header/banner rows (value='').
  const infoboxFields: KV[] = infoboxLines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      if (!trimmed.includes('=')) return { key: trimmed, value: '' }; // banner row
      const ix = trimmed.indexOf('=');
      const key = trimmed.slice(0, ix).trim();
      const value = trimmed.slice(ix + 1).trim();
      if (key.toLowerCase() === 'couleur_accent') return null;
      return { key, value };
    })
    .filter((r): r is KV => r !== null);

  // ── [MAILLOTS] ────────────────────────────────────────────────────────────
  // Each non-empty line inside a [MAILLOTS] block: "Domicile = #FFF | #00F"
  const jerseyLines = buckets.filter((b) => b.tag === 'MAILLOTS').flatMap((b) => b.content);
  const infoboxJerseys: WBJersey[] = jerseyLines
    .filter((l) => l.includes('='))
    .map((l) => {
      const ix = l.indexOf('=');
      const name = l.slice(0, ix).trim();
      const colors = l.slice(ix + 1).split('|').map(clean).filter(Boolean);
      return { name, colors };
    })
    .filter((j) => j.colors.length > 0);

  // ── [INFOBOX_SECTION] ─────────────────────────────────────────────────────
  // Multiple [INFOBOX_SECTION] blocks are supported; each has a "titre =" line
  // followed by "Clé = Valeur" pairs.
  const infoboxSections: WBInfoboxSection[] = buckets
    .filter((b) => b.tag === 'INFOBOX_SECTION')
    .map((b) => ({
      title: field(b.content, 'titre') || field(b.content, 'title') || 'Section',
      fields: b.content
        .filter((l) => l.includes('=') && !l.trim().toLowerCase().startsWith('titre =') && !l.trim().toLowerCase().startsWith('title ='))
        .map((l) => { const ix = l.indexOf('='); return { key: l.slice(0, ix).trim(), value: l.slice(ix + 1).trim() }; }),
    }))
    .filter((s) => s.fields.length > 0);

  return {
    id: `page-${Date.now()}`, title, subtitle: clean(first('SOUS-TITRE').join('\n')),
    aliases: [...first('ALIASES'), ...first('ALIAS')].flatMap((line) => line.split(',')).map(clean).filter(Boolean),
    introduction: clean(first('INTRODUCTION').join('\n')), infobox: infoboxFields,
    infoboxImage: imageLines.length ? imageFrom(imageLines) : undefined, sections, links: first('LIENS').map(clean).filter(Boolean),
    references: fields(first('REFERENCES')), bibliography: first('BIBLIOGRAPHIE').map(clean).filter(Boolean),
    categories: first('CATEGORIES').map(clean).filter(Boolean), category, type, sourceText, updatedAt: now, createdAt: now,
    history: [{ timestamp: now, label: 'Import initial', sourceText }], isTrashed: false,
    // Priority: [COULEUR] block > couleur_accent in [INFOBOX] > undefined
    accentColor: clean(first('COULEUR').join('')) || couleurAccentInline || undefined,
    infoboxJerseys: infoboxJerseys.length > 0 ? infoboxJerseys : undefined,
    infoboxSections: infoboxSections.length > 0 ? infoboxSections : undefined,
  };
}

export const demoSource = `[TITRE]
Universa Lacora

[SOUS-TITRE]
Université métropolitaine de Caledora

[ALIASES]
Université de Caledora
Campus Lacora
Universa

[INTRODUCTION]
Universa Lacora est le principal ensemble universitaire de Caledora.
Elle accueille environ 52 000 étudiants sur son campus principal.

[INFOBOX]
Nom = Universa Lacora
Nom original = Universa Metropolitana Lacora
Type = Université publique
Fondation = 1684
Président = Mateo Ferran
Ville = Caledora
Étudiants = 52 000
Enseignants = 4 800
Budget = 1,8 milliard d’euros
Site web = universa-lacora.cal

[IMAGE_INFOBOX]
fichier = universa_lacora.jpg
légende = Vue du campus principal d’Universa Lacora
alt = Campus d’Universa Lacora

[SECTION]
Histoire

[TEXTE]
Universa Lacora trouve son origine dans un collège fondé en 1684.

[TEXTE]
L’établissement est progressivement devenu l’une des principales universités de la région.

[SOUS-SECTION]
Création du campus moderne

[TEXTE]
Le campus actuel est développé à partir de 1958 autour du lac de Lacora.

[SECTION]
Organisation

[TEXTE]
L’université est organisée autour de plusieurs facultés et instituts.

[LISTE]
Faculté de droit
Faculté de médecine
Faculté des sciences
Faculté d’économie

[SECTION]
Campus

[TEXTE]
Le campus principal se situe à Campus Aurea.

[IMAGE]
fichier = campus_aurea.jpg
légende = Campus Aurea vu depuis le lac
alignement = droite
taille = 300
alt = Bâtiments de Campus Aurea

[SECTION]
Recherche

[TEXTE]
Les activités de recherche couvrent notamment les sciences, la médecine et l’ingénierie.

[TABLEAU]
titre = Principaux instituts
colonnes = Institut | Domaine | Chercheurs
ligne = Sciencia Park | Sciences fondamentales | 850
ligne = Technova | Ingénierie | 620
ligne = Instituto Medica | Médecine | 410

[SECTION]
Voir aussi

[LIENS]
Caledora
Sciencia Park
Technova Lacora
Campus Aurea

[REFERENCES]
1 = Archives de Caledora, Universa Lacora, 2025
2 = Rapport annuel de l’université, 2026

[BIBLIOGRAPHIE]
Annuaire métropolitain de Caledora, édition 2026

[CATEGORIES]
Université
Caledora
Enseignement supérieur`;

// ─── Persistence (IndexedDB via idb-keyval) ──────────────────────────────────

const IDB_KEY = 'wikibase-pages';

const BACKUP_AT_KEY = 'wikibase-pages-backup-at';
/**
 * Strip transient blob-URL src values from every image in a page before
 * persisting. Images are NEVER stored as base64 — only their filename is kept.
 */
function stripSrc(page: WikiPage): WikiPage {
  const noSrc = (img?: WBImage): WBImage | undefined =>
    img ? { ...img, src: undefined } : undefined;
  return {
    ...page,
    infoboxImage: noSrc(page.infoboxImage),
    infoboxImageOverride: noSrc(page.infoboxImageOverride),
    sections: page.sections.map((s) => ({
      ...s,
      blocks: s.blocks.map((b) =>
        b.type === 'image' ? { ...b, image: noSrc(b.image)! } : b
      ),
    })),
  };
}

/** Load all pages from IndexedDB, migrating from localStorage on first run. */
export async function loadPages(): Promise<WikiPage[]> {
  const { get, set } = await import('idb-keyval');

  // 1. IndexedDB is the primary store
  const idb = await get<WikiPage[]>(IDB_KEY);
  if (idb && idb.length > 0) return idb;

  // 2. One-time migration from localStorage → IndexedDB
  const ls = localStorage.getItem(IDB_KEY);
  if (ls) {
    try {
      const pages = (JSON.parse(ls) as WikiPage[]).map(stripSrc);
      await set(IDB_KEY, pages);
      localStorage.removeItem(IDB_KEY);
      return pages;
    } catch { /* corrupt data — fall through to seed */ }
  }

  // 3. First-ever run: seed with the built-in demo page
  const page = parseWikiText(demoSource, 'Éducation', 'Université');
  page.id = 'universa-lacora';
  await set(IDB_KEY, [page]);
  return [page];
}

/** Persist pages to IndexedDB and wait for the operation to complete. */
export async function savePagesAsync(pages: WikiPage[]): Promise<void> {
  const snapshot = pages.map(stripSrc);
  const write = pageWriteQueue.catch(() => undefined).then(async () => {
    const { set } = await import('idb-keyval');
    await set(IDB_KEY, snapshot);
  });
  pageWriteQueue = write;
  return write;
}

/**
 * Queue a page write without blocking the regular editor UI. Callers that
 * require durable storage (such as navigation-critical actions) can await the
 * returned promise. Image `src` blob URLs are always stripped before writing.
 */
export function savePages(pages: WikiPage[]): Promise<void> {
  const write = savePagesAsync(pages);
  void write.catch((err) => console.error('[WikiBase] savePages failed:', err));
  return write;
}

/** Wait for every previously requested page write before reading page data. */
export async function waitForPendingPageWrites(): Promise<void> {
  await pageWriteQueue;
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export function formatDate(value: string) { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
export function allText(page: WikiPage) { return `${page.title} ${page.subtitle} ${page.introduction} ${page.categories.join(' ')}`.toLowerCase(); }

const isKVArray = (value: unknown): value is KV[] =>
  Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.key === 'string' && typeof item.value === 'string');

/** Build a portable backup from the current IndexedDB page store. */
export async function createPagesBackup(): Promise<PagesBackup> {
  await waitForPendingPageWrites();
  return {
    schema: PAGES_BACKUP_SCHEMA,
    version: PAGES_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    pages: (await loadPages()).map(stripSrc),
  };
}

/**
 * Validate and restore a pages backup. Existing pages are replaced only after
 * the complete file has been validated, so malformed JSON cannot erase data.
 */
export async function restorePagesBackup(value: unknown): Promise<WikiPage[]> {
  const parsed = pagesFromBackup(value);
  if (!parsed || parsed.pages.length === 0) {
    throw new Error('Ce fichier ne contient pas une sauvegarde WikiBase valide.');
  }
  const pages = parsed.pages.map(stripSrc);
  await savePagesAsync(pages);
  return pages;
}

/** Download a WikiBase-only JSON backup and record that the export succeeded. */
export function downloadPagesBackup(backup: PagesBackup): void {
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `wikibase-pages-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  recordPagesBackupAt(backup.exportedAt);
}

function recordPagesBackupAt(value: string) {
  try {
    localStorage.setItem(BACKUP_AT_KEY, value);
  } catch (error) {
    console.error('[WikiBase] backup timestamp could not be saved:', error);
  }
}

const PAGES_BACKUP_SCHEMA = 'wikibase-pages-backup';

export type PagesBackup = {
  schema: typeof PAGES_BACKUP_SCHEMA;
  version: typeof PAGES_BACKUP_VERSION;
  exportedAt: string;
  pages: WikiPage[];
};

const PAGES_BACKUP_VERSION = 1;

let pageWriteQueue: Promise<void> = Promise.resolve();

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

function pagesFromBackup(value: unknown): { pages: WikiPage[]; exportedAt?: string } | null {
  if (Array.isArray(value) && value.every(isWikiPage)) return { pages: value };
  if (!isRecord(value)) return null;

  const pages = value.schema === PAGES_BACKUP_SCHEMA && value.version === PAGES_BACKUP_VERSION
    ? value.pages
    : isRecord(value.wikibase) ? value.wikibase.pages : value.pages;
  if (!Array.isArray(pages) || !pages.every(isWikiPage)) return null;
  return { pages, exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : undefined };
}

/** Return the date of the last completed WikiBase export, if one exists. */
export function getLastPagesBackupAt(): string | null {
  try {
    const value = localStorage.getItem(BACKUP_AT_KEY);
    return value && !Number.isNaN(new Date(value).getTime()) ? value : null;
  } catch {
    return null;
  }
}

const isImage = (value: unknown): value is WBImage =>
  isRecord(value)
  && ['filename', 'caption', 'alt', 'alignment', 'size'].every((key) => typeof value[key] === 'string')
  && typeof value.missing === 'boolean'
  && (value.src === undefined || typeof value.src === 'string');

function isWikiPage(value: unknown): value is WikiPage {
  if (!isRecord(value)) return false;
  const strings = ['id', 'title', 'subtitle', 'introduction', 'category', 'type', 'sourceText', 'updatedAt', 'createdAt'];
  if (!strings.every((key) => typeof value[key] === 'string') || typeof value.isTrashed !== 'boolean') return false;
  if (!isStringArray(value.aliases) || !isKVArray(value.infobox) || !isStringArray(value.links)
    || !isKVArray(value.references) || !isStringArray(value.bibliography) || !isStringArray(value.categories)) return false;
  if (value.infoboxImage !== undefined && !isImage(value.infoboxImage)) return false;
  if (!Array.isArray(value.history) || !value.history.every((item) =>
    isRecord(item) && typeof item.timestamp === 'string' && typeof item.label === 'string' && typeof item.sourceText === 'string')) return false;
  if (!Array.isArray(value.sections) || !value.sections.every((section) =>
    isRecord(section) && typeof section.title === 'string' && typeof section.level === 'number'
    && Array.isArray(section.blocks) && section.blocks.every((block) => {
      if (!isRecord(block)) return false;
      if (block.type === 'text') return typeof block.content === 'string';
      if (block.type === 'list' || block.type === 'numbered') return isStringArray(block.items);
      if (block.type === 'image') return isImage(block.image);
      if (block.type !== 'table' || !isRecord(block.table)) return false;
      return typeof block.table.title === 'string' && isStringArray(block.table.columns)
        && Array.isArray(block.table.rows) && block.table.rows.every(isStringArray);
    }))) return false;
  if (value.accentColor !== undefined && typeof value.accentColor !== 'string') return false;
  if (value.infoboxJerseys !== undefined && (!Array.isArray(value.infoboxJerseys)
    || !value.infoboxJerseys.every((item) => isRecord(item) && typeof item.name === 'string' && isStringArray(item.colors)))) return false;
  return value.infoboxSections === undefined || (Array.isArray(value.infoboxSections)
    && value.infoboxSections.every((item) => isRecord(item) && typeof item.title === 'string' && isKVArray(item.fields)));
}
