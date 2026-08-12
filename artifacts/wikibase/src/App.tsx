import { createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { Archive, ArrowLeft, Check, ChevronRight, Clock3, FileText, GitCompare, Image as ImageIcon, Menu, Pencil, Plus, RotateCcw, Search, Settings2, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import { allText, demoSource, formatDate, parseWikiText, savePages, seedPages, type WBBlock, type WBImage, type WBInfoboxSection, type WBJersey, type WBSection, type WikiPage } from '@/lib/wikibase';

/* ─── Appearance context ─────────────────────────────────────────────────── */

type Theme = 'auto' | 'light' | 'dark';
type Width = 'standard' | 'large';
interface Appearance { theme: Theme; width: Width }
interface AppearanceCtx { appearance: Appearance; setAppearance: (a: Appearance) => void }

const AppearanceContext = createContext<AppearanceCtx>({
  appearance: { theme: 'auto', width: 'standard' },
  setAppearance: () => {},
});
const useAppearance = () => useContext(AppearanceContext);

function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(() => {
    try {
      const saved = localStorage.getItem('wikibase-appearance');
      if (saved) return JSON.parse(saved) as Appearance;
    } catch {}
    return { theme: 'auto', width: 'standard' };
  });

  // Apply dark class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (appearance.theme === 'dark') {
      root.classList.add('dark');
      return;
    }
    if (appearance.theme === 'light') {
      root.classList.remove('dark');
      return;
    }
    // auto: follow system preference
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (e: MediaQueryList | MediaQueryListEvent) =>
      e.matches ? root.classList.add('dark') : root.classList.remove('dark');
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [appearance.theme]);

  const setAppearance = (a: Appearance) => {
    setAppearanceState(a);
    localStorage.setItem('wikibase-appearance', JSON.stringify(a));
  };

  return <AppearanceContext.Provider value={{ appearance, setAppearance }}>{children}</AppearanceContext.Provider>;
}

/* ─── Category accent colours ───────────────────────────────────────────── */

const CATEGORY_COLORS: Record<string, string> = {
  'Géographie': '#c8e6c9',
  'Histoire': '#ffe0b2',
  'Culture': '#e1bee7',
  'Sciences': '#b2dfdb',
  'Politique': '#bbdefb',
  'Économie': '#fff9c4',
  'Éducation': '#cee0f2',
  'Transports': '#eeeeee',
  'Monuments & Lieux': '#f9e4b7',
  'Personnes & Organisations': '#fce4ec',
  'Sports & Football': '#dceefb',
};
const categoryColor = (cat: string) => CATEGORY_COLORS[cat] ?? '#cee0f2';

/* ─── Category & type catalogue ─────────────────────────────────────────── */

const CATEGORY_TYPES: Record<string, string[]> = {
  'Géographie': [
    'Ville', 'Commune', 'Capitale', 'Métropole', 'Agglomération', 'Village', 'Quartier',
    'Arrondissement', 'Région', 'Province', 'Département', 'Pays', 'État fédéré',
    'Territoire', 'Île', 'Archipel', 'Péninsule', 'Continent',
    'Montagne', 'Sommet', 'Col', 'Massif', 'Chaîne de montagnes',
    'Fleuve', 'Rivière', 'Lac', 'Mer', 'Océan', 'Détroit', 'Golfe', 'Baie',
    'Plaine', 'Plateau', 'Désert', 'Forêt', 'Parc naturel',
  ],
  'Histoire': [
    'Événement historique', 'Bataille', 'Guerre', 'Révolution', 'Traité',
    'Période historique', 'Civilisation', 'Empire', 'Royaume', 'République',
    'Découverte', 'Exploration', 'Site archéologique', 'Monument historique',
  ],
  'Culture': [
    'Œuvre littéraire', 'Roman', 'Poème', 'Pièce de théâtre', 'Essai',
    'Film', 'Court-métrage', 'Documentaire', 'Série télévisée', 'Émission',
    'Album musical', 'Chanson', 'Symphonie', 'Opéra',
    'Tableau', 'Sculpture', 'Photographie', "Œuvre d'art",
    'Jeu vidéo', 'Bande dessinée', 'Manga', 'Animation',
    'Festival', 'Prix culturel', 'Mouvement artistique',
  ],
  'Sciences': [
    'Concept scientifique', 'Théorie', 'Loi physique', 'Formule',
    'Espèce animale', 'Espèce végétale', 'Espèce bactérienne',
    'Élément chimique', 'Molécule', 'Réaction chimique',
    'Phénomène naturel', 'Écosystème', 'Biome',
    'Découverte scientifique', 'Invention', 'Technologie',
    'Planète', 'Étoile', 'Galaxie', 'Constellation', 'Phénomène astronomique',
  ],
  'Politique': [
    'Parti politique', 'Mouvement politique', 'Idéologie',
    'Institution', 'Parlement', 'Gouvernement', 'Ministère',
    'Organisation internationale', 'Alliance', 'Traité diplomatique',
    'Élection', 'Référendum', 'Loi', 'Constitution',
  ],
  'Économie': [
    'Entreprise', 'Multinationale', 'Start-up', 'Coopérative',
    'Secteur économique', 'Industrie', 'Marché',
    'Banque', 'Institution financière', 'Bourse',
    'Produit commercial', 'Marque', 'Franchise',
  ],
  'Éducation': [
    'Université', 'Grande école', 'Institut', 'École supérieure',
    'Lycée', 'Collège', 'École primaire', 'École spécialisée',
    'Discipline académique', 'Filière', 'Diplôme',
    'Programme éducatif', 'Réforme scolaire',
  ],
  'Transports': [
    'Aéroport', 'Port', 'Gare', 'Station',
    'Ligne de métro', 'Ligne de tramway', 'Ligne ferroviaire', 'Autoroute',
    'Tunnel', 'Pont', 'Canal', 'Viaduc',
    'Compagnie aérienne', 'Compagnie ferroviaire', 'Réseau de transport',
  ],
  'Monuments & Lieux': [
    'Monument', 'Cathédrale', 'Église', 'Mosquée', 'Temple', 'Synagogue',
    'Château', 'Palais', 'Forteresse', 'Citadelle',
    'Musée', 'Bibliothèque', 'Théâtre', 'Opéra', 'Stade',
    'Site classé', 'Patrimoine mondial UNESCO',
    'Parc', 'Jardin public', 'Place publique',
  ],
  'Sports & Football': [
    'Club de football',
    'Saison de club',
    'Stade / Arena',
    "Centre d'entraînement / Académie",
    'Effectif / Joueur',
    'Entraîneur / Staff',
    'Mascotte officielle',
    'Groupe de supporters / Ultras',
    'Derby / Rivalité sportive',
    'Compétition / Trophée',
    'Équipementier / Sponsor',
  ],
  'Personnes & Organisations': [
    'Personnalité politique', "Chef d'État", 'Monarque',
    'Scientifique', 'Explorateur', 'Inventeur',
    'Écrivain', 'Poète', 'Philosophe',
    'Artiste', 'Peintre', 'Sculpteur', 'Photographe',
    'Musicien', 'Compositeur', 'Chanteur',
    'Acteur', 'Réalisateur', 'Producteur',
    'Sportif', 'Athlète', 'Entraîneur',
    'Entrepreneur', 'Industriel',
    'Organisation non gouvernementale', 'Association', 'Fondation',
    'Article général',
  ],
};
const ALL_CATEGORIES = Object.keys(CATEGORY_TYPES);

/* ─── Appearance panel ───────────────────────────────────────────────────── */

function AppearancePanel({ onClose }: { onClose: () => void }) {
  const { appearance, setAppearance } = useAppearance();
  const set = (patch: Partial<Appearance>) => setAppearance({ ...appearance, ...patch });

  const themeOptions: { value: Theme; label: string; desc: string }[] = [
    { value: 'auto', label: 'Automatique', desc: 'Suit le système' },
    { value: 'light', label: 'Clair', desc: '' },
    { value: 'dark', label: 'Sombre', desc: '' },
  ];
  const widthOptions: { value: Width; label: string; desc: string }[] = [
    { value: 'standard', label: 'Standard', desc: '~960 px' },
    { value: 'large', label: 'Large', desc: 'Pleine largeur' },
  ];

  return (
    <div className="appearance-panel">
      <div className="appearance-panel-header">
        <span className="font-bold text-sm">Apparence</span>
        <button onClick={onClose} className="appearance-panel-close" aria-label="Fermer"><X size={14} /></button>
      </div>

      <div className="appearance-panel-section">
        <div className="appearance-panel-label">Couleur</div>
        {themeOptions.map(({ value, label, desc }) => (
          <label key={value} className="appearance-panel-option">
            <input type="radio" name="theme" value={value} checked={appearance.theme === value} onChange={() => set({ theme: value })} className="appearance-panel-radio" />
            <span className="flex-1 text-sm">{label}</span>
            {desc && <span className="text-[11px] text-muted-foreground">{desc}</span>}
          </label>
        ))}
      </div>

      <div className="appearance-panel-section">
        <div className="appearance-panel-label">Largeur</div>
        {widthOptions.map(({ value, label, desc }) => (
          <label key={value} className="appearance-panel-option">
            <input type="radio" name="width" value={value} checked={appearance.width === value} onChange={() => set({ width: value })} className="appearance-panel-radio" />
            <span className="flex-1 text-sm">{label}</span>
            <span className="text-[11px] text-muted-foreground">{desc}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ─── Shared UI primitives ──────────────────────────────────────────────── */

function Button({ children, className = '', variant = 'default', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'danger' }) {
  const variants = {
    default: 'bg-primary text-primary-foreground hover:brightness-110',
    outline: 'border border-[var(--wiki-border)] bg-[#f8f9fa] hover:bg-[#eaecf0] text-foreground dark:bg-secondary dark:hover:bg-muted dark:border-border',
    ghost: 'hover:bg-secondary text-foreground',
    danger: 'border border-destructive/30 text-destructive hover:bg-destructive/10',
  };
  return (
    <button className={`inline-flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition duration-150 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'green' | 'rust' }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] ${tone === 'green' ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' : tone === 'rust' ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800' : 'bg-[#f8f9fa] border border-[var(--wiki-border)] text-muted-foreground dark:bg-secondary dark:border-border'}`}>
      {children}
    </span>
  );
}

function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded border border-dashed border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-secondary px-6 text-center">
      <Archive size={20} className="mb-3 text-muted-foreground" />
      <h3 className="font-bold text-base">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── Shell ─────────────────────────────────────────────────────────────── */

function Shell({ children }: { children: ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [query, setQuery] = useState('');
  const [, setLocation] = useLocation();
  const { appearance } = useAppearance();

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) setLocation(`/?q=${encodeURIComponent(query.trim())}`);
  };

  const maxW = appearance.width === 'large' ? 'max-w-[1300px]' : 'max-w-[960px]';

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-background">
      {/* Top header */}
      <header className="border-b border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background sticky top-0 z-30">
        <div className={`${maxW} mx-auto flex items-center gap-3 px-4 py-2`}>
          <button className="md:hidden text-muted-foreground" onClick={() => setMobile(!mobile)} aria-label="Menu">
            <Menu size={18} />
          </button>
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary overflow-hidden">
              <svg viewBox="0 0 60 60" className="h-7 w-7" aria-hidden>
                <circle cx="30" cy="30" r="28" fill="transparent" stroke="#a2a9b1" strokeWidth="2"/>
                <text x="30" y="38" textAnchor="middle" fontSize="28" fontFamily="Georgia,serif" fill="currentColor" fontWeight="bold">W</text>
              </svg>
            </div>
            <div className="leading-tight">
              <div className="font-bold text-[16px] leading-none">WikiBase</div>
              <div className="text-[10px] text-muted-foreground">L'encyclopédie libre locale</div>
            </div>
          </Link>

          <form onSubmit={doSearch} className="flex flex-1 min-w-0 items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher sur WikiBase"
              className="h-8 flex-1 min-w-0 rounded-l border border-r-0 border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-3 text-sm outline-none focus:border-primary"
            />
            <button type="submit" className="h-8 rounded-r border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-muted px-3 hover:bg-[#eaecf0] dark:hover:bg-secondary shrink-0">
              <Search size={14} />
            </button>
          </form>

          <nav className="hidden md:flex items-center gap-3 text-xs shrink-0">
            <Link href="/create" className="wiki-link flex items-center gap-1">
              <Plus size={13} /> Créer
            </Link>
            <Link href="/trash" className="wiki-link">Corbeille</Link>
          </nav>

          {/* Appearance toggle */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowAppearance((v) => !v)}
              aria-label="Apparence"
              title="Apparence"
              className={`flex h-8 w-8 items-center justify-center rounded border border-[var(--wiki-border)] dark:border-border text-sm font-bold transition hover:bg-[#eaecf0] dark:hover:bg-secondary ${showAppearance ? 'bg-[#eaecf0] dark:bg-secondary' : 'bg-white dark:bg-background'}`}
            >
              <Settings2 size={15} />
            </button>
            {showAppearance && <AppearancePanel onClose={() => setShowAppearance(false)} />}
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      {mobile && (
        <div className="border-b border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-secondary px-4 py-3 text-sm">
          <Link href="/" onClick={() => setMobile(false)} className="wiki-link block py-1">Tableau de bord</Link>
          <Link href="/create" onClick={() => setMobile(false)} className="wiki-link block py-1">Créer une page</Link>
          <Link href="/trash" onClick={() => setMobile(false)} className="wiki-link block py-1">Corbeille</Link>
        </div>
      )}

      {/* Overlay to close appearance panel */}
      {showAppearance && <div className="fixed inset-0 z-20" onClick={() => setShowAppearance(false)} />}

      {/* Content — width controlled by appearance */}
      <main className={`${maxW} mx-auto px-4 py-4`}>
        {children}
      </main>
    </div>
  );
}

/* ─── Dashboard ─────────────────────────────────────────────────────────── */

function Dashboard() {
  const [location] = useLocation();
  const qs = new URLSearchParams(location.includes('?') ? location.split('?')[1] : '');
  const urlQ = qs.get('q') ?? '';
  const [pages, setPages] = useState(seedPages);
  const [query, setQuery] = useState(urlQ);
  const [filter, setFilter] = useState('Toutes');
  const visible = pages.filter(
    (p) => !p.isTrashed && allText(p).includes(query.toLowerCase()) && (filter === 'Toutes' || p.category === filter)
  );
  const categories = ['Toutes', ...Array.from(new Set(pages.filter((p) => !p.isTrashed).map((p) => p.category)))];

  return (
    <div className="animate-rise">
      <h1 className="font-editorial text-[2em] font-normal mb-1">Toutes les pages</h1>
      <div className="border-b border-[var(--wiki-border)] dark:border-border pb-3 mb-5 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-3">
        <span>{visible.length} page{visible.length !== 1 ? 's' : ''} · stockage local</span>
        <Link href="/create" className="wiki-link flex items-center gap-1 text-sm"><Plus size={13} /> Créer une nouvelle page</Link>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block max-w-md flex-1">
          <Search className="absolute left-2.5 top-2 text-muted-foreground" size={14} />
          <input
            data-testid="input-search-pages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer les pages..."
            className="h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary pl-8 pr-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <button
              data-testid={`button-filter-${cat}`}
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-sm px-2 py-1 text-xs ${filter === cat ? 'bg-[#eaecf0] dark:bg-muted font-bold' : 'wiki-link hover:underline'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Pages actives', value: String(visible.length) },
          { label: 'Catégories', value: String(categories.length - 1) },
          { label: 'Format source', value: 'TXT' },
          { label: 'Stockage', value: 'Local' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-secondary p-3">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`} className="text-xl font-bold mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      {visible.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((page, i) => {
            const color = page.accentColor ?? categoryColor(page.category);
            return (
              <Link
                href={`/page/${page.id}`}
                data-testid={`card-page-${page.id}`}
                key={page.id}
                className={`group block rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4 hover:border-primary/50 transition ${i === 0 ? 'lg:col-span-2' : ''}`}
                style={{ borderTopWidth: 3, borderTopColor: color }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Badge tone="green">Publié</Badge>
                      <span>{page.category}</span>
                      <span>·</span>
                      <span>{page.type}</span>
                      <span>·</span>
                      <span>{formatDate(page.updatedAt)}</span>
                    </div>
                    <h2 data-testid={`text-page-title-${page.id}`} className={`wiki-link font-editorial ${i === 0 ? 'text-[1.6em]' : 'text-[1.3em]'} group-hover:underline`}>{page.title}</h2>
                    {page.subtitle && <p className="text-sm text-muted-foreground mt-0.5 italic">{page.subtitle}</p>}
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{page.introduction}</p>
                  </div>
                  <ChevronRight size={15} className="shrink-0 text-muted-foreground mt-1" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--wiki-border)] dark:border-border pt-2">
                  {page.categories.slice(0, 4).map((c) => <span key={c} className="text-[11px] wiki-link">{c}</span>)}
                  <span className="ml-auto text-[11px] text-muted-foreground">{page.sections.length} sections</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty title="Aucune page trouvée" text="Modifiez votre recherche ou importez un nouveau fichier TXT." action={<Link href="/create" className="wiki-link text-sm">Créer une page</Link>} />
      )}
    </div>
  );
}

/* ─── SyntaxGuide ────────────────────────────────────────────────────────── */

function CodeSnippet({ children }: { children: string }) {
  return (
    <pre className="syntax-guide-code">{children.trim()}</pre>
  );
}

function SyntaxGuide({ category }: { category: string }) {
  const [open, setOpen] = useState(false);
  const isSport = category === 'Sports & Football';

  return (
    <div className="syntax-guide rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card">
      <button
        className="syntax-guide-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--wiki-toc-bg)] dark:bg-secondary border border-[var(--wiki-border)] dark:border-border text-[10px]">?</span>
          <span className="font-bold text-sm">Référence de syntaxe</span>
          {isSport && (
            <span className="rounded-full bg-[#dceefb] dark:bg-primary/20 text-[10px] font-bold px-2 py-0.5 text-primary">⚽ Sports & Football</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{open ? 'masquer ▲' : 'afficher ▼'}</span>
      </button>

      {open && (
        <div className="syntax-guide-body">

          {/* ── Sport-specific (shown first when category matches) ── */}
          {isSport && (
            <div className="syntax-guide-section syntax-guide-section--sport">
              <div className="syntax-guide-section-title">⚽ Fonctionnalités Sports & Football</div>

              <div className="syntax-guide-row">
                <div className="syntax-guide-label">
                  <strong>Maillots</strong>
                  <span>Silhouettes colorées (max 5 couleurs par kit, séparées par <code>|</code>)</span>
                </div>
                <CodeSnippet>{`
[MAILLOTS]
Domicile  = #FFFFFF | #003399 | #FF0000
Extérieur = #000000 | #FFFFFF
3ème      = #FF6600 | #FFFFFF
                `}</CodeSnippet>
              </div>

              <div className="syntax-guide-row">
                <div className="syntax-guide-label">
                  <strong>Drapeaux inline</strong>
                  <span>Dans n'importe quelle valeur d'infobox ou texte — code ISO 2 lettres</span>
                </div>
                <CodeSnippet>{`
[INFOBOX]
Pays    = {{flag:fr}} France
Ligue   = {{flag:eu}} Ligue des champions
Fondé   = 1899 · {{flag:es}} Barcelone
                `}</CodeSnippet>
              </div>

              <div className="syntax-guide-row">
                <div className="syntax-guide-label">
                  <strong>Sous-sections infobox</strong>
                  <span>Palmarès, statistiques… Plusieurs blocs possibles. Le champ <code>titre</code> est obligatoire.</span>
                </div>
                <CodeSnippet>{`
[INFOBOX_SECTION]
titre        = Palmarès
Championnat  = 27 titres
Coupe nat.   = 3 titres
Europe       = 1 titre (2018)

[INFOBOX_SECTION]
titre    = Stade
Nom      = Stade Lacora
Capacité = 45 000 places
                `}</CodeSnippet>
              </div>

              <div className="syntax-guide-row">
                <div className="syntax-guide-label">
                  <strong>Couleur d'accent</strong>
                  <span>Remplace la couleur de l'en-tête de l'infobox (peut aussi être défini via le sélecteur ci-dessus)</span>
                </div>
                <CodeSnippet>{`
[COULEUR]
#003399
                `}</CodeSnippet>
              </div>
            </div>
          )}

          {/* ── Universal tags ── */}
          <div className="syntax-guide-section">
            <div className="syntax-guide-section-title">Balises universelles</div>

            <div className="syntax-guide-row">
              <div className="syntax-guide-label">
                <strong>Structure de base</strong>
                <span>Chaque balise <code>[TAG]</code> ouvre un bloc. Les lignes qui suivent sont son contenu.</span>
              </div>
              <CodeSnippet>{`
[TITRE]
Nom de la page

[SOUS-TITRE]
Description courte

[INTRODUCTION]
Texte d'introduction…

[INFOBOX]
Clé 1 = Valeur
Clé 2 = [[Lien interne]]
              `}</CodeSnippet>
            </div>

            <div className="syntax-guide-row">
              <div className="syntax-guide-label">
                <strong>Sections du texte</strong>
                <span>3 niveaux de titres disponibles</span>
              </div>
              <CodeSnippet>{`
[SECTION]
Titre principal (niveau 1)

[SOUS-SECTION]
Sous-titre (niveau 2)

[SOUS-SOUS-SECTION]
Sous-sous-titre (niveau 3)

[TEXTE]
Paragraphe de texte normal.

[LISTE]
Premier élément
Deuxième élément

[LISTE_NUMEROTEE]
Étape 1
Étape 2
              `}</CodeSnippet>
            </div>

            <div className="syntax-guide-row">
              <div className="syntax-guide-label">
                <strong>Liens & références</strong>
                <span><code>[[Titre]]</code> crée un lien interne vers une autre page WikiBase</span>
              </div>
              <CodeSnippet>{`
[LIENS]
Nom d'une autre page
Caledora

[REFERENCES]
1 = Source, Auteur, 2026

[BIBLIOGRAPHIE]
Titre du livre, Auteur, Éditeur, 2026

[CATEGORIES]
Football
Espagne
              `}</CodeSnippet>
            </div>

            <div className="syntax-guide-row">
              <div className="syntax-guide-label">
                <strong>Image dans l'infobox</strong>
              </div>
              <CodeSnippet>{`
[IMAGE_INFOBOX]
fichier    = nom_du_fichier.jpg
légende    = Description de l'image
alt        = Texte alternatif
              `}</CodeSnippet>
            </div>
          </div>

          {/* ── Tip ── */}
          <p className="syntax-guide-tip">
            💡 Les balises inconnues ou mal orthographiées sont silencieusement ignorées par le parser — votre page reste valide.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── CreatePage ─────────────────────────────────────────────────────────── */

function SourcePreview({ page }: { page: WikiPage }) {
  const color = page.accentColor ?? categoryColor(page.category);
  return (
    <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-5">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--wiki-border)] dark:border-border pb-4">
        <div>
          <Badge tone="green">Analyse réussie</Badge>
          <h2 className="mt-2 font-editorial text-[1.5em]">{page.title}</h2>
          <p className="text-sm text-muted-foreground">{page.sections.length} sections · {page.infobox.length} champs</p>
        </div>
        <ShieldCheck className="text-primary" size={22} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
        <div>
          <p className="text-sm leading-6">{page.introduction}</p>
          <div className="mt-4 space-y-3">
            {page.sections.slice(0, 2).map((s) => (
              <div key={s.title}>
                <h3 className="font-bold text-sm border-b border-[var(--wiki-border)] dark:border-border pb-1">{s.title}</h3>
                {s.blocks.slice(0, 1).map((b, i) =>
                  b.type === 'text' ? <p key={i} className="mt-1 text-xs text-muted-foreground line-clamp-3">{b.content}</p> : null
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="wiki-infobox h-fit">
          <div className="wiki-infobox-header" style={{ background: color }}>{page.title}</div>
          <div className="p-2">
            {page.infobox.slice(0, 6).map((r) => (
              <div key={r.key} className="grid grid-cols-[45%_55%] border-b border-[var(--wiki-border)] dark:border-border py-1 text-xs last:border-0">
                <span className="font-bold">{r.key}</span>
                <span className="text-muted-foreground">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatePage() {
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState(demoSource);
  const [category, setCategory] = useState('Éducation');
  const [type, setType] = useState('Université');
  const [accentColor, setAccentColor] = useState(categoryColor('Éducation'));
  const [parsed, setParsed] = useState<WikiPage | null>(null);
  const [filename, setFilename] = useState('exemple_universa_lacora.txt');

  const typeOptions = CATEGORY_TYPES[category] ?? CATEGORY_TYPES['Personnes & Organisations'];

  const analyze = () => {
    const p = parseWikiText(source, category, type);
    p.accentColor = accentColor;
    setParsed(p);
  };
  const onFile = (file?: File) => {
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => { setSource(String(reader.result)); setParsed(null); };
    reader.readAsText(file);
  };
  const publish = () => {
    if (!parsed) return;
    const pages = seedPages().filter((p) => p.id !== parsed.id);
    savePages([...pages, { ...parsed, accentColor }]);
    setLocation(`/page/${parsed.id}`);
  };

  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-editorial text-[2em] font-normal">Créer une page</h1>
        <Link href="/" className="wiki-link text-sm flex items-center gap-1"><ArrowLeft size={13} /> Retour</Link>
      </div>
      <div className="border-b border-[var(--wiki-border)] dark:border-border mb-5 pb-3 text-sm text-muted-foreground">
        Importez un fichier TXT balisé. WikiBase l'analyse de façon déterministe, sans reformulation.
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,1fr)]">
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4">
            <div className="mb-3 font-bold text-sm flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">1</span>
              Classer la page
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                Catégorie
                <select
                  data-testid="select-category"
                  value={category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setCategory(cat);
                    setType(CATEGORY_TYPES[cat]?.[0] ?? '');
                    setAccentColor(categoryColor(cat));
                  }}
                  className="mt-1 h-9 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-2 text-sm font-normal"
                >
                  {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold">
                Type
                <select
                  data-testid="select-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-2 text-sm font-normal"
                >
                  {typeOptions.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
            </div>
            {/* Accent colour */}
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs font-bold shrink-0">Couleur de l'infobox</label>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-8 w-14 cursor-pointer rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary p-0.5"
                title="Couleur d'en-tête de l'infobox"
              />
              <span className="font-mono-app text-[11px] text-muted-foreground">{accentColor}</span>
              <button onClick={() => setAccentColor(categoryColor(category))} className="wiki-link text-[11px]">Réinitialiser</button>
            </div>
          </div>

          {/* Syntax guide — adapts to the selected category */}
          <SyntaxGuide category={category} />

          {/* Step 2 */}
          <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4">
            <div className="mb-3 font-bold text-sm flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">2</span>
              Importer la source TXT
            </div>
            <button
              data-testid="button-upload-txt"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center rounded border border-dashed border-primary/40 bg-[#f8f9fa] dark:bg-secondary px-4 py-6 text-center hover:bg-[#eaecf0] dark:hover:bg-muted transition"
            >
              <Upload size={20} className="mb-2 text-primary" />
              <span className="text-sm font-bold">{filename}</span>
              <span className="text-xs text-muted-foreground mt-0.5">Cliquez pour choisir un fichier .txt</span>
            </button>
            <input ref={inputRef} data-testid="input-upload-txt" type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <textarea
              data-testid="textarea-source"
              value={source}
              onChange={(e) => { setSource(e.target.value); setParsed(null); }}
              className="mt-3 min-h-[240px] w-full resize-y rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary p-3 font-mono-app text-xs leading-5 outline-none focus:border-primary"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-mono-app">{source.split('\n').length} lignes · {source.length} car.</span>
              <Button data-testid="button-analyze-source" onClick={analyze}><ShieldCheck size={14} /> Analyser</Button>
            </div>
          </div>
        </div>

        {/* Preview column */}
        <div className="xl:sticky xl:top-16 xl:self-start">
          {parsed ? (
            <>
              <SourcePreview page={parsed} />
              <Button data-testid="button-publish-page" onClick={publish} className="mt-3 w-full py-2.5">
                <Check size={14} /> Publier localement
              </Button>
            </>
          ) : (
            <div className="flex min-h-[380px] flex-col items-center justify-center rounded border border-dashed border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-secondary p-8 text-center">
              <FileText size={28} className="text-muted-foreground" />
              <h2 className="mt-4 font-bold text-base">Aperçu en attente</h2>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">Cliquez sur « Analyser » pour prévisualiser le résultat avant publication.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── TableOfContents ───────────────────────────────────────────────────── */

/** Compute hierarchical numbering: level-2 → "1", level-3 → "1.1", level-4 → "1.1.1" */
function computeTocNumbers(sections: WBSection[]): string[] {
  let l2 = 0, l3 = 0, l4 = 0;
  return sections.map((s) => {
    if (s.level === 2) { l2++; l3 = 0; l4 = 0; return `${l2}`; }
    if (s.level === 3) { l3++; l4 = 0; return `${l2}.${l3}`; }
    if (s.level === 4) { l4++; return `${l2}.${l3}.${l4}`; }
    return '';
  });
}

function TableOfContents({ sections }: { sections: WBSection[] }) {
  const [open, setOpen] = useState(true);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const visibleRef = useRef<Set<number>>(new Set());
  const numbers = computeTocNumbers(sections);

  /* ScrollSpy: observe each section and highlight the topmost visible one */
  useEffect(() => {
    if (sections.length === 0) return;
    const els = sections
      .map((_, i) => document.getElementById(`section-${i}`))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = parseInt(entry.target.id.replace('section-', ''), 10);
          if (entry.isIntersecting) {
            visibleRef.current.add(idx);
          } else {
            visibleRef.current.delete(idx);
          }
        });
        if (visibleRef.current.size > 0) {
          setActiveIdx(Math.min(...visibleRef.current));
        }
      },
      /* Intersection zone: top of viewport down to 20 % height — sections that
         enter this band become "active". Adjust rootMargin to taste. */
      { rootMargin: '0px 0px -78% 0px', threshold: 0 },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  /* Smooth-scroll to section on click */
  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, idx: number) => {
    e.preventDefault();
    const el = document.getElementById(`section-${idx}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveIdx(idx);
  };

  const topLevel = sections.filter((s) => s.level === 2);
  if (topLevel.length < 3) return null;

  return (
    <nav className="wiki-toc-sidebar" aria-label="Sommaire">
      <div className="wiki-toc-sidebar-header">
        <span className="wiki-toc-sidebar-title">Sommaire</span>
        <button
          className="wiki-toc-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? 'Masquer le sommaire' : 'Afficher le sommaire'}
        >
          {open ? 'masquer' : 'afficher'}
        </button>
      </div>

      {open && (
        <ol className="wiki-toc-list">
          {sections.map((s, i) => {
            if (s.level !== 2) return null;
            return (
              <li
                key={`${s.title}-${i}`}
                className={['wiki-toc-item', activeIdx === i ? 'wiki-toc-item--active' : ''].filter(Boolean).join(' ')}
              >
                <a href={`#section-${i}`} onClick={(e) => scrollTo(e, i)}>
                  <span className="wiki-toc-num">{numbers[i]}</span>
                  {s.title}
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}

/* ─── ReaderPage ─────────────────────────────────────────────────────────── */

/** Convert a 2-letter ISO country code to its flag emoji (for {{flag:xx}} syntax). */
function flagEmoji(code: string): string {
  return code.toUpperCase().split('').map((c) =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('');
}

function InternalText({ text, pages }: { text: string; pages: WikiPage[] }) {
  // Matches: [[Wiki links]], {{flag:xx}} (emoji), [flag: gb-eng] (image)
  const parts = text.split(/(\[\[[^\]]+\]\]|\{\{flag:[a-zA-Z]{2,3}\}\}|\[flag:\s*[a-zA-Z0-9-]+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        // [[Internal link]]
        const wikiMatch = part.match(/^\[\[([^\]]+)\]\]$/);
        if (wikiMatch) {
          const name = wikiMatch[1];
          const target = pages.find((p) => p.title.toLowerCase() === name.toLowerCase());
          return target
            ? <Link data-testid={`link-internal-${name}`} key={i} href={`/page/${target.id}`} className="wiki-link">{name}</Link>
            : <span data-testid={`link-missing-${name}`} key={i} className="wiki-link-red">{name}</span>;
        }
        // {{flag:xx}} → emoji
        const flagEmojiMatch = part.match(/^\{\{flag:([a-zA-Z]{2,3})\}\}$/);
        if (flagEmojiMatch) {
          const code = flagEmojiMatch[1];
          return <span key={i} title={code.toUpperCase()} aria-label={`Drapeau ${code.toUpperCase()}`}>{flagEmoji(code)}</span>;
        }
        // [flag: gb-eng] → <img> from flagcdn.com
        const flagImgMatch = part.match(/^\[flag:\s*([a-zA-Z0-9-]+)\]$/);
        if (flagImgMatch) {
          const code = flagImgMatch[1].toLowerCase();
          return (
            <img
              key={i}
              src={`https://flagcdn.com/w20/${code}.png`}
              srcSet={`https://flagcdn.com/w40/${code}.png 2x`}
              alt={code}
              title={code.toUpperCase()}
              className="inline-flag"
            />
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** SVG logo placeholder shown when an infobox image file is missing. */
function LogoPlaceholder({ initial, color }: { initial: string; color: string }) {
  return (
    <svg viewBox="0 0 80 80" width="72" height="72" aria-label="Logo manquant" role="img">
      <circle cx="40" cy="40" r="38" fill={color} fillOpacity="0.15" stroke={color} strokeOpacity="0.35" strokeWidth="2" />
      <text
        x="40" y="53"
        textAnchor="middle"
        fontSize="34"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="bold"
        fill={color}
        fillOpacity="0.6"
      >
        {initial}
      </text>
    </svg>
  );
}

/** Renders a single jersey kit as vertical color stripes in a jersey silhouette. */
function JerseyKit({ jersey }: { jersey: WBJersey }) {
  const cols = jersey.colors.slice(0, 5);
  const stripeW = 100 / cols.length;
  return (
    <div className="infobox-jersey-kit">
      <svg viewBox="0 0 40 46" width="36" height="42" aria-hidden="true">
        {/* jersey body clip path */}
        <defs>
          <clipPath id={`jersey-clip-${jersey.name}`}>
            {/* sleeves + body silhouette */}
            <path d="M10,5 L0,18 L7,21 L7,46 L33,46 L33,21 L40,18 L30,5 Q25,2 20,2 Q15,2 10,5Z" />
          </clipPath>
        </defs>
        {/* color stripes clipped to jersey shape */}
        <g clipPath={`url(#jersey-clip-${jersey.name})`}>
          {cols.map((color, i) => (
            <rect key={i} x={i * stripeW * 0.4} y="0" width={stripeW * 0.4} height="46" fill={color} />
          ))}
          {/* fallback full fill for first color behind stripes */}
          <rect x="0" y="0" width="40" height="46" fill={cols[0]} style={{ zIndex: -1 }} />
          {cols.map((color, i) => (
            <rect key={`s-${i}`} x={i * (40 / cols.length)} y="0" width={40 / cols.length} height="46" fill={color} />
          ))}
        </g>
        {/* collar */}
        <path d="M15,5 Q20,10 25,5" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
      </svg>
      <span className="infobox-jersey-label">{jersey.name}</span>
    </div>
  );
}

/** A titled sub-section of key-value rows within the infobox. */
function InfoboxSection({ section, pages }: { section: WBInfoboxSection; pages: WikiPage[] }) {
  return (
    <>
      <div className="infobox-section-title">{section.title}</div>
      {section.fields.map((r) => (
        <div key={r.key} className="grid grid-cols-[44%_56%] border-b border-[var(--wiki-border)] dark:border-border py-1 px-1 text-xs last:border-0">
          <span className="font-bold">{r.key}</span>
          <span><InternalText text={r.value} pages={pages} /></span>
        </div>
      ))}
    </>
  );
}

function Infobox({ page, pages }: { page: WikiPage; pages: WikiPage[] }) {
  const accentColor = page.accentColor ?? categoryColor(page.category);
  return (
    <aside data-testid="content-infobox" className="wiki-infobox w-full lg:float-right lg:clear-right lg:ml-5 lg:mb-4 lg:w-[280px] lg:shrink-0 mb-4">
      <div className="wiki-infobox-header" style={{ background: accentColor }}>{page.title}</div>

      {/* Optional image */}
      {page.infoboxImage && (
        <div className="flex items-center justify-center border-b border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-muted py-2 text-center text-xs text-muted-foreground overflow-hidden" style={{ minHeight: 140 }}>
          {page.infoboxImage.src
            ? <img src={page.infoboxImage.src} alt={page.infoboxImage.alt} className="max-h-40 max-w-full object-contain" />
            : <LogoPlaceholder initial={page.title[0]?.toUpperCase() ?? '?'} color={accentColor} />
          }
        </div>
      )}

      {/* Optional jersey kits — only rendered when [MAILLOTS] is in the source */}
      {page.infoboxJerseys && page.infoboxJerseys.length > 0 && (
        <div className="infobox-jerseys border-b border-[var(--wiki-border)] dark:border-border">
          <div className="infobox-section-title">Maillots</div>
          <div className="infobox-jerseys-row">
            {page.infoboxJerseys.map((j) => <JerseyKit key={j.name} jersey={j} />)}
          </div>
        </div>
      )}

      {/* Base infobox key-value fields */}
      <div className="p-1">
        {page.infobox.map((r) => (
          <div key={r.key} className="grid grid-cols-[44%_56%] border-b border-[var(--wiki-border)] dark:border-border py-1 px-1 text-xs last:border-0">
            <span className="font-bold">{r.key}</span>
            <span><InternalText text={r.value} pages={pages} /></span>
          </div>
        ))}

        {/* Optional sub-sections — only rendered when [INFOBOX_SECTION] blocks are in the source */}
        {page.infoboxSections?.map((s) => (
          <InfoboxSection key={s.title} section={s} pages={pages} />
        ))}
      </div>
    </aside>
  );
}

function BlockView({ block, pages }: { block: WBBlock; pages: WikiPage[] }) {
  if (block.type === 'text') return <p className="text-sm leading-7"><InternalText text={block.content} pages={pages} /></p>;
  if (block.type === 'list' || block.type === 'numbered') {
    const List = block.type === 'list' ? 'ul' : 'ol';
    return (
      <List className={`my-2 text-sm leading-7 ${block.type === 'list' ? 'list-disc pl-6' : 'list-decimal pl-6'}`}>
        {block.items.map((item) => <li key={item}><InternalText text={item} pages={pages} /></li>)}
      </List>
    );
  }
  if (block.type === 'image') {
    const img = block.image;
    const alignClass = img.alignment === 'droite' ? 'lg:float-right lg:clear-right lg:ml-4 lg:mb-2' : img.alignment === 'gauche' ? 'lg:float-left lg:clear-left lg:mr-4 lg:mb-2' : 'mx-auto my-3';
    return (
      <figure data-testid={`image-block-${img.filename}`} className={`${alignClass} w-full lg:w-[220px] border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-secondary p-1 text-center mb-3`}>
        <div className="flex h-32 items-center justify-center overflow-hidden bg-[#eaecf0] dark:bg-muted text-xs text-muted-foreground">
          {img.src
            ? <img src={img.src} alt={img.alt} className="max-h-full max-w-full object-contain" />
            : <><ImageIcon size={14} className="mr-1" />Image manquante</>
          }
        </div>
        <figcaption className="pt-1 text-[11px] text-center text-muted-foreground">{img.caption || img.filename}</figcaption>
      </figure>
    );
  }
  if (block.type === 'table') {
    return (
      <div data-testid={`table-block-${block.table.title}`} className="my-3 overflow-x-auto">
        {block.table.title && <div className="text-sm font-bold mb-1">{block.table.title}</div>}
        <table className="border-collapse text-sm">
          <thead>
            <tr>{block.table.columns.map((c) => <th key={c} className="border border-[#a2a9b1] dark:border-border bg-[#eaecf0] dark:bg-muted px-3 py-1.5 font-bold text-left">{c}</th>)}</tr>
          </thead>
          <tbody>
            {block.table.rows.map((row, i) => (
              <tr key={i} className="even:bg-[#f8f9fa] dark:even:bg-secondary/30">
                {row.map((cell, j) => <td key={j} className="border border-[#a2a9b1] dark:border-border px-3 py-1.5">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

function ImageEditor({ image, label, onChange, onDelete }: { image: WBImage; label: string; onChange: (image: WBImage) => void; onDelete: () => void }) {
  const replace = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...image, filename: file.name, src: String(reader.result), missing: false });
    reader.readAsDataURL(file);
  };
  const set = (key: keyof WBImage, value: string) => onChange({ ...image, [key]: value });
  return (
    <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-secondary p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2"><ImageIcon size={14} className="text-primary" /><span className="text-sm font-bold truncate">{label}</span></div>
        <button data-testid={`button-delete-image-${label}`} onClick={onDelete} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-bold">Fichier<input data-testid={`input-image-file-${label}`} value={image.filename} onChange={(e) => set('filename', e.target.value)} className="mt-1 h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background px-2 text-xs font-normal" /></label>
        <label className="text-xs font-bold">Légende<input data-testid={`input-image-caption-${label}`} value={image.caption} onChange={(e) => set('caption', e.target.value)} className="mt-1 h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background px-2 text-xs font-normal" /></label>
        <label className="text-xs font-bold">Texte alt<input data-testid={`input-image-alt-${label}`} value={image.alt} onChange={(e) => set('alt', e.target.value)} className="mt-1 h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background px-2 text-xs font-normal" /></label>
        <div className="grid grid-cols-2 gap-1">
          <label className="text-xs font-bold">Alignement<select data-testid={`select-image-alignment-${label}`} value={image.alignment} onChange={(e) => set('alignment', e.target.value)} className="mt-1 h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background px-2 text-xs font-normal"><option>gauche</option><option>centre</option><option>droite</option></select></label>
          <label className="text-xs font-bold">Taille<input data-testid={`input-image-size-${label}`} value={image.size} onChange={(e) => set('size', e.target.value)} className="mt-1 h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background px-2 text-xs font-normal" /></label>
        </div>
      </div>
      <label className="mt-2 flex cursor-pointer items-center justify-center rounded border border-dashed border-primary/40 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/5">
        <Upload size={12} className="mr-1" /> Remplacer
        <input data-testid={`input-replace-image-${label}`} type="file" accept="image/*" className="hidden" onChange={(e) => replace(e.target.files?.[0])} />
      </label>
    </div>
  );
}

function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const [pages, setPages] = useState(seedPages);
  const page = pages.find((p) => p.id === id) ?? pages[0];
  const [, setLocation] = useLocation();

  const remove = () => {
    if (!window.confirm('Déplacer cette page dans la corbeille ?')) return;
    const next = pages.map((p) => p.id === page.id ? { ...p, isTrashed: true, updatedAt: new Date().toISOString() } : p);
    setPages(next); savePages(next); setLocation('/');
  };

  return (
    <div className="animate-rise">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground mb-2">
        <Link href="/" className="wiki-link">Accueil</Link>
        <span className="mx-1">›</span>
        <span>{page.category}</span>
        <span className="mx-1">›</span>
        <span>{page.title}</span>
      </div>

      <h1 className="font-editorial text-[2em] font-normal leading-tight mb-0.5">{page.title}</h1>
      {page.subtitle && <p className="text-base text-muted-foreground mb-2 italic">{page.subtitle}</p>}

      {/* Tab bar */}
      <div className="flex items-end border-b border-[var(--wiki-border)] dark:border-border mb-0 mt-3">
        <div className="flex gap-0 -mb-px">
          <span className="wiki-tab wiki-tab-active">Article</span>
          <span className="wiki-tab">Discussion</span>
        </div>
        <div className="ml-auto flex items-end gap-0 -mb-px text-[13px]">
          <span className="wiki-tab wiki-tab-active">Lire</span>
          <Link href={`/page/${page.id}/edit`} data-testid="link-edit-page" className="wiki-tab">Modifier</Link>
          <Link href={`/page/${page.id}/history`} data-testid="link-history-page" className="wiki-tab">Voir l'historique</Link>
          <Link href={`/page/${page.id}/compare`} data-testid="link-compare-page" className="wiki-tab">Comparer</Link>
          <button onClick={remove} data-testid="button-trash-page" className="wiki-tab text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
        </div>
      </div>

      {/* Meta line */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--wiki-border)] dark:border-border py-2 mb-4 text-[12px] text-muted-foreground">
        <Badge tone="muted">{page.category}</Badge>
        <Badge tone="muted">{page.type}</Badge>
        <span>Créé le {formatDate(page.createdAt)}</span>
        <span>·</span>
        <span>Modifié le {formatDate(page.updatedAt)}</span>
        <Link href="/" className="ml-auto wiki-link flex items-center gap-1"><ArrowLeft size={11} /> Retour</Link>
      </div>

      {/* Two-column layout: TOC sidebar + article body */}
      <div className="reader-layout">
        <TableOfContents sections={page.sections} />

        <div className="reader-main" data-testid="article-page-content">
        <div className="article-body clearfix" style={{ '--page-accent': page.accentColor ?? categoryColor(page.category) } as React.CSSProperties}>
        <Infobox page={page} pages={pages} />

        {page.aliases.length > 0 && (
          <p className="text-sm italic text-muted-foreground mb-3">
            Également connu sous le nom de : {page.aliases.join(', ')}.
          </p>
        )}

        <p className="text-sm leading-7 mb-4">
          <InternalText text={page.introduction} pages={pages} />
        </p>

        {page.sections.map((section, i) => (
          <section data-testid={`section-${i}`} id={`section-${i}`} key={`${section.title}-${i}`} className="mb-6 scroll-mt-16">
            {section.level === 2 && <h2 className="wiki-h2">{section.title}</h2>}
            {section.level === 3 && <h3 className="wiki-h3">{section.title}</h3>}
            {section.level === 4 && <h4 className="wiki-h4">{section.title}</h4>}
            <div className="space-y-2">
              {section.blocks.map((block, j) => <BlockView key={j} block={block} pages={pages} />)}
            </div>
          </section>
        ))}

        {page.links.length > 0 && (
          <div className="mt-8 border-t border-[var(--wiki-border)] dark:border-border pt-5 clear-both">
            <h2 className="wiki-h2">Voir aussi</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {page.links.map((l) => {
                const target = pages.find((p) => p.title.toLowerCase() === l.toLowerCase());
                return target
                  ? <Link data-testid={`link-see-also-${l}`} key={l} href={`/page/${target.id}`} className="wiki-link text-sm">{l}</Link>
                  : <span data-testid={`link-see-also-missing-${l}`} key={l} className="wiki-link-red text-sm">{l}</span>;
              })}
            </div>
          </div>
        )}

        {page.references.length > 0 && (
          <div className="mt-6 border-t border-[var(--wiki-border)] dark:border-border pt-4 clear-both">
            <h2 className="wiki-h2">Notes et références</h2>
            <ol className="mt-2 list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
              {page.references.map((r) => <li key={r.key}>{r.value}</li>)}
            </ol>
          </div>
        )}

        {page.bibliography.length > 0 && (
          <div className="mt-6 border-t border-[var(--wiki-border)] dark:border-border pt-4 clear-both">
            <h2 className="wiki-h2">Bibliographie</h2>
            {page.bibliography.map((b) => <p key={b} className="text-sm text-muted-foreground mt-1">{b}</p>)}
          </div>
        )}

        {page.categories.length > 0 && (
          <div className="mt-8 border-t border-[var(--wiki-border)] dark:border-border pt-3 clear-both">
            <span className="text-sm font-bold mr-2">Catégories :</span>
            {page.categories.map((c, i) => (
              <span key={c}>
                {i > 0 && <span className="mx-1 text-muted-foreground">·</span>}
                <span className="wiki-link text-sm">{c}</span>
              </span>
            ))}
          </div>
        )}
        </div>{/* /article-body */}
        </div>{/* /reader-main */}
      </div>{/* /reader-layout */}
    </div>
  );
}

/* ─── EditPage ───────────────────────────────────────────────────────────── */

function EditPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [pages, setPages] = useState(seedPages);
  const original = pages.find((p) => p.id === id) ?? pages[0];
  const [page, setPage] = useState<WikiPage>(() => structuredClone(original));

  const update = (key: keyof WikiPage, value: unknown) => setPage((p) => ({ ...p, [key]: value }));
  const save = () => {
    const next = pages.map((p) => p.id === page.id
      ? { ...page, updatedAt: new Date().toISOString(), history: [...p.history, { timestamp: new Date().toISOString(), label: 'Modification visuelle', sourceText: page.sourceText }] }
      : p
    );
    setPages(next); savePages(next); setLocation(`/page/${page.id}`);
  };
  const updateInfo = (index: number, value: string, key: 'key' | 'value') =>
    update('infobox', page.infobox.map((r, i) => i === index ? { ...r, [key]: value } : r));
  const updateSectionBlock = (si: number, bi: number, block: WBBlock) =>
    update('sections', page.sections.map((s, i) => i === si ? { ...s, blocks: s.blocks.map((b, j) => j === bi ? block : b) } : s));

  const currentColor = page.accentColor ?? categoryColor(page.category);

  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-editorial text-[1.8em] font-normal">Modifier : {page.title}</h1>
        <div className="flex gap-2 items-center">
          <Link href={`/page/${page.id}`} data-testid="link-cancel-edit" className="wiki-link text-sm">Annuler</Link>
          <Button data-testid="button-save-page" onClick={save}><Check size={14} /> Enregistrer</Button>
        </div>
      </div>
      <div className="border-b border-[var(--wiki-border)] dark:border-border mb-5 pb-2 text-xs text-muted-foreground">
        Chaque sauvegarde ajoute une version à l'historique.
      </div>

      <div className="mx-auto max-w-3xl space-y-4">
        {/* Identity */}
        <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4">
          <div className="mb-3 font-bold">Identité</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold">Titre<input data-testid="input-edit-title" value={page.title} onChange={(e) => update('title', e.target.value)} className="mt-1 h-9 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-2 text-sm font-normal" /></label>
            <label className="text-xs font-bold">Sous-titre<input data-testid="input-edit-subtitle" value={page.subtitle} onChange={(e) => update('subtitle', e.target.value)} className="mt-1 h-9 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-2 text-sm font-normal" /></label>
          </div>
          <label className="mt-3 block text-xs font-bold">Introduction<textarea data-testid="textarea-edit-introduction" value={page.introduction} onChange={(e) => update('introduction', e.target.value)} className="mt-1 min-h-24 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary p-2 text-sm font-normal leading-6" /></label>
        </div>

        {/* Infobox colour */}
        <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4">
          <div className="mb-3 font-bold">Couleur de l'infobox</div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => update('accentColor', e.target.value)}
              className="h-10 w-16 cursor-pointer rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary p-0.5"
            />
            <span className="font-mono-app text-xs text-muted-foreground">{currentColor}</span>
            <button onClick={() => update('accentColor', categoryColor(page.category))} className="wiki-link text-xs">Réinitialiser selon la catégorie</button>
            <div className="h-8 flex-1 min-w-[120px] rounded border border-[var(--wiki-border)] dark:border-border text-center text-xs font-bold flex items-center justify-center" style={{ background: currentColor }}>
              Aperçu en-tête
            </div>
          </div>
        </div>

        {/* Infobox fields */}
        <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4">
          <div className="mb-3 flex items-center justify-between font-bold">
            Infobox
            <Button data-testid="button-add-infobox-field" variant="outline" onClick={() => update('infobox', [...page.infobox, { key: 'Nouveau champ', value: '' }])}>
              <Plus size={13} /> Ajouter
            </Button>
          </div>
          <div className="space-y-1.5">
            {page.infobox.map((row, i) => (
              <div key={i} className="flex gap-1.5">
                <input data-testid={`input-infobox-key-${i}`} value={row.key} onChange={(e) => updateInfo(i, e.target.value, 'key')} className="w-2/5 rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-2 py-1.5 text-sm" />
                <input data-testid={`input-infobox-value-${i}`} value={row.value} onChange={(e) => updateInfo(i, e.target.value, 'value')} className="flex-1 rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-2 py-1.5 text-sm" />
                <button data-testid={`button-delete-infobox-${i}`} onClick={() => update('infobox', page.infobox.filter((_, j) => j !== i))} className="rounded p-1.5 text-muted-foreground hover:text-destructive"><X size={13} /></button>
              </div>
            ))}
          </div>
        </div>

        {page.infoboxImage && (
          <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4">
            <div className="mb-3 font-bold">Image de l'infobox</div>
            <ImageEditor label="infobox" image={page.infoboxImage} onChange={(img) => update('infoboxImage', img)} onDelete={() => update('infoboxImage', undefined)} />
          </div>
        )}

        {/* Sections */}
        <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4">
          <div className="mb-3 flex items-center justify-between font-bold">
            Sections <Badge>{page.sections.length}</Badge>
          </div>
          {page.sections.map((section, i) => (
            <div key={`${section.title}-${i}`} className="mb-3 rounded border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-secondary p-3">
              <div className="flex items-center gap-2">
                <input data-testid={`input-section-title-${i}`} value={section.title} onChange={(e) => update('sections', page.sections.map((s, j) => j === i ? { ...s, title: e.target.value } : s))} className="flex-1 border-b border-[var(--wiki-border)] dark:border-border bg-transparent px-1 py-0.5 font-bold text-sm outline-none focus:border-primary" />
                <button data-testid={`button-delete-section-${i}`} onClick={() => update('sections', page.sections.filter((_, j) => j !== i))} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
              </div>
              <div className="mt-2 space-y-1.5">
                {section.blocks.map((block, j) =>
                  block.type === 'text'
                    ? <div key={j} className="flex gap-1.5">
                        <textarea data-testid={`textarea-block-${i}-${j}`} value={block.content} onChange={(e) => updateSectionBlock(i, j, { ...block, content: e.target.value })} className="min-h-16 flex-1 rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background p-2 text-sm leading-5" />
                        <button data-testid={`button-delete-block-${i}-${j}`} onClick={() => update('sections', page.sections.map((s, si) => si === i ? { ...s, blocks: s.blocks.filter((_, bi) => bi !== j) } : s))} className="h-8 rounded p-1 text-muted-foreground hover:text-destructive"><X size={13} /></button>
                      </div>
                    : block.type === 'image'
                      ? <ImageEditor key={j} label={`section-${i}-${j}`} image={block.image} onChange={(img) => updateSectionBlock(i, j, { ...block, image: img })} onDelete={() => update('sections', page.sections.map((s, si) => si === i ? { ...s, blocks: s.blocks.filter((_, bi) => bi !== j) } : s))} />
                      : <div key={j} className="flex items-center gap-1.5 rounded bg-white dark:bg-background p-2 text-xs text-muted-foreground">
                          Bloc {block.type === 'table' ? 'tableau' : 'liste'} — conservé depuis la source
                          <button data-testid={`button-delete-block-${i}-${j}`} onClick={() => update('sections', page.sections.map((s, si) => si === i ? { ...s, blocks: s.blocks.filter((_, bi) => bi !== j) } : s))} className="ml-auto text-destructive"><X size={13} /></button>
                        </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── ComparePage ────────────────────────────────────────────────────────── */

function ComparePage() {
  const { id } = useParams<{ id: string }>();
  const pages = seedPages();
  const page = pages.find((p) => p.id === id) ?? pages[0];
  const [source, setSource] = useState('');
  const [candidate, setCandidate] = useState<WikiPage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');

  const analyze = () => setCandidate(parseWikiText(source || demoSource, page.category, page.type));
  const changed = candidate
    ? [
        { label: 'Titre', old: page.title, next: candidate.title },
        { label: 'Introduction', old: page.introduction, next: candidate.introduction },
        { label: 'Nombre de sections', old: String(page.sections.length), next: String(candidate.sections.length) },
      ].filter((d) => d.old !== d.next)
    : [];
  const apply = () => {
    if (!candidate) return;
    savePages(pages.map((p) => p.id === page.id
      ? { ...candidate, id: page.id, history: [...page.history, { timestamp: new Date().toISOString(), label: 'Mise à jour depuis un TXT', sourceText: candidate.sourceText }] }
      : p
    ));
    setStatus('Mise à jour appliquée');
  };

  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-editorial text-[1.8em] font-normal">Comparer une source</h1>
        <Link href={`/page/${page.id}`} data-testid="link-back-reader" className="wiki-link text-sm flex items-center gap-1"><ArrowLeft size={13} /> Retour</Link>
      </div>
      <div className="border-b border-[var(--wiki-border)] dark:border-border mb-5 pb-2 text-sm text-muted-foreground">
        Comparer un nouveau TXT avec « {page.title} ». Rien ne sera appliqué sans votre décision.
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4">
          <div className="mb-3 flex items-center justify-between font-bold">
            Nouvelle source
            <Button data-testid="button-choose-compare-file" variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload size={13} /> Choisir un TXT
            </Button>
          </div>
          <input ref={inputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setSource(String(r.result)); r.readAsText(f); } }} />
          <textarea data-testid="textarea-compare-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Collez un TXT ou choisissez un fichier..." className="min-h-[340px] w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary p-3 font-mono-app text-xs leading-5" />
          <Button data-testid="button-analyze-compare" onClick={analyze} className="mt-3 w-full">
            <GitCompare size={14} /> Analyser les différences
          </Button>
        </div>

        <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4">
          {candidate ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <Badge tone={changed.length ? 'rust' : 'green'}>{changed.length ? `${changed.length} différence${changed.length > 1 ? 's' : ''}` : 'Identique'}</Badge>
                  <h2 className="mt-1 font-bold">Résultat structuré</h2>
                </div>
                <ShieldCheck className="text-primary" size={20} />
              </div>
              {changed.length ? (
                <div className="space-y-2">
                  {changed.map((d) => (
                    <div key={d.label} className="rounded border border-[var(--wiki-border)] dark:border-border p-3">
                      <div className="mb-1 text-xs font-bold">{d.label}</div>
                      <div className="grid gap-2 text-xs sm:grid-cols-2">
                        <div className="border-l-2 border-muted-foreground/40 pl-2 text-muted-foreground"><span className="mb-1 block font-bold">Ancien</span>{d.old}</div>
                        <div className="border-l-2 border-accent pl-2"><span className="mb-1 block font-bold text-accent">Nouveau</span>{d.next}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="Aucune différence" text="Les deux sources produisent la même structure." />
              )}
              {status
                ? <div data-testid="status-compare" className="mt-4 rounded border border-primary/30 bg-blue-50 dark:bg-blue-950 p-3 text-sm text-primary">{status}</div>
                : <div className="mt-4 flex gap-2">
                    <Button data-testid="button-apply-compare" onClick={apply}><Check size={14} /> Appliquer</Button>
                    <Button data-testid="button-ignore-compare" variant="outline" onClick={() => { setCandidate(null); setStatus('Mise à jour ignorée'); }}><X size={14} /> Ignorer</Button>
                  </div>
              }
            </>
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
              <GitCompare size={26} className="text-muted-foreground" />
              <h2 className="mt-3 font-bold">Aucune comparaison</h2>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">Importez une nouvelle source pour voir uniquement les champs qui changent.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── HistoryPage ────────────────────────────────────────────────────────── */

function HistoryPage() {
  const { id } = useParams<{ id: string }>();
  const page = seedPages().find((p) => p.id === id) ?? seedPages()[0];
  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-editorial text-[1.8em] font-normal">Historique : {page.title}</h1>
        <Link href={`/page/${page.id}`} data-testid="link-history-back" className="wiki-link text-sm flex items-center gap-1"><ArrowLeft size={13} /> Retour</Link>
      </div>
      <div className="border-b border-[var(--wiki-border)] dark:border-border mb-5 pb-2 text-sm text-muted-foreground">
        Chaque version conserve la source TXT exacte qui a produit la page.
      </div>
      <div className="max-w-2xl space-y-2">
        {[...page.history].reverse().map((item, i) => (
          <div data-testid={`history-row-${i}`} key={item.timestamp} className="flex gap-3 rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4">
            <Clock3 size={16} className="mt-0.5 shrink-0 text-primary" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-sm">{item.label}</span>
                <span className="text-[11px] text-muted-foreground font-mono-app">{formatDate(item.timestamp)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.sourceText.split('\n').length} lignes · {item.sourceText.length} caractères</p>
              <button data-testid={`button-view-source-${i}`} onClick={() => window.alert(item.sourceText)} className="mt-2 text-xs wiki-link">Voir la source TXT</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── TrashPage ──────────────────────────────────────────────────────────── */

function TrashPage() {
  const [pages, setPages] = useState(seedPages);
  const trashed = pages.filter((p) => p.isTrashed);
  const restore = (id: string) => { const n = pages.map((p) => p.id === id ? { ...p, isTrashed: false } : p); setPages(n); savePages(n); };
  const destroy = (id: string) => { const n = pages.filter((p) => p.id !== id); setPages(n); savePages(n); };
  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-editorial text-[2em] font-normal">Corbeille</h1>
        <Link href="/" data-testid="link-trash-back" className="wiki-link text-sm flex items-center gap-1"><ArrowLeft size={13} /> Retour</Link>
      </div>
      <div className="border-b border-[var(--wiki-border)] dark:border-border mb-5 pb-2 text-sm text-muted-foreground">
        Les pages supprimées restent ici jusqu'à leur suppression définitive locale.
      </div>
      {trashed.length ? (
        <div className="space-y-2 max-w-2xl">
          {trashed.map((p) => (
            <div key={p.id} data-testid={`trash-row-${p.id}`} className="flex flex-col justify-between gap-3 rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-editorial text-[1.3em]">{p.title}</h2>
                <p className="text-xs text-muted-foreground">{p.type} · supprimée le {formatDate(p.updatedAt)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button data-testid={`button-restore-${p.id}`} variant="outline" onClick={() => restore(p.id)}><RotateCcw size={13} /> Restaurer</Button>
                <Button data-testid={`button-delete-permanently-${p.id}`} variant="danger" onClick={() => destroy(p.id)}><Trash2 size={13} /> Supprimer</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="La corbeille est vide" text="Les pages supprimées apparaîtront ici, avec leur source intacte." />
      )}
    </div>
  );
}

/* ─── Root ───────────────────────────────────────────────────────────────── */

function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="text-xs text-muted-foreground mb-2">Erreur 404</div>
      <h1 className="font-editorial text-[2em] font-normal">Page introuvable</h1>
      <Link href="/" className="mt-4 wiki-link text-sm">Retour à l'accueil</Link>
    </div>
  );
}

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/create" component={CreatePage} />
        <Route path="/page/:id/edit" component={EditPage} />
        <Route path="/page/:id/compare" component={ComparePage} />
        <Route path="/page/:id/history" component={HistoryPage} />
        <Route path="/page/:id" component={ReaderPage} />
        <Route path="/trash" component={TrashPage} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <AppearanceProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AppearanceProvider>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
