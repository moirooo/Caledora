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
  /** Conditional — only present when [MAILLOTS] is declared in the source. */
  infoboxJerseys?: WBJersey[];
  /** Conditional — only present when [INFOBOX_SECTION] blocks are declared. */
  infoboxSections?: WBInfoboxSection[];
};

const tags = new Set(['TITRE','SOUS-TITRE','ALIASES','INTRODUCTION','INFOBOX','IMAGE_INFOBOX','SECTION','SOUS-SECTION','SOUS-SOUS-SECTION','TEXTE','LISTE','LISTE_NUMEROTEE','IMAGE','TABLEAU','LIENS','REFERENCES','BIBLIOGRAPHIE','CATEGORIES','COULEUR','MAILLOTS','INFOBOX_SECTION']);
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
    if (bucket.tag === 'TEXTE' && clean(bucket.content.join('\n'))) active.blocks.push({ type: 'text', content: clean(bucket.content.join('\n')) });
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
    id: `page-${Date.now()}`, title, subtitle: clean(first('SOUS-TITRE').join('\n')), aliases: first('ALIASES').map(clean).filter(Boolean),
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

/**
 * Persist pages to IndexedDB (fire-and-forget — never blocks the UI).
 * Image `src` blob URLs are always stripped before writing.
 */
export function savePages(pages: WikiPage[]): void {
  import('idb-keyval')
    .then(({ set }) => set(IDB_KEY, pages.map(stripSrc)))
    .catch((err) => console.error('[WikiBase] savePages failed:', err));
}
export function formatDate(value: string) { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
export function allText(page: WikiPage) { return `${page.title} ${page.subtitle} ${page.introduction} ${page.categories.join(' ')}`.toLowerCase(); }