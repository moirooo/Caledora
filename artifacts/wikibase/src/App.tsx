import 'flag-icons/css/flag-icons.min.css';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import { allText, createPagesBackup, demoSource, downloadPagesBackup, formatDate, getDisplayInfoboxImage, getLastPagesBackupAt, loadPages, normalizeStr, parseWikiText, restorePagesBackup, savePages, type WBBlock, type WBImage, type WBInfoboxSection, type WBJersey, type WBSection, type WBTable, type WikiPage } from '@/lib/wikibase';
import { getUploadedMedia, uploadMedia } from '@workspace/media-upload';
import OriaBank from '@/pages/OriaBank.jsx';
import { TWITTER_ACCOUNTS, TWITTER_ACCOUNT_TEMPLATES, type TwitterAccountCategory } from '@/data/twitterAccounts';
import { socialAccountProfiles } from '@/data/socialAccounts';
import { InstagramApp } from '@/components/instagram/InstagramApp';
import { loadInstagramDatabase, mediaUrl as instagramMediaUrl, saveInstagramDatabase, updateInstagramProfile, type InstagramProfile, type InstagramRelationType } from '@/services/instagramStorage';
import { decodeTwitterRouteHandle, formatTwitterCount, isTwitterHandleTaken, normalizeTwitterHandle } from '@/services/twitterProfile';
import { GlobalBackupPage } from '@/components/GlobalBackupPage';

/* ─── Appearance context ─────────────────────────────────────────────────── */
import { AlertTriangle, Archive, ArrowDown, ArrowLeft, ArrowUp, BarChart2, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, Download, FileText, GitCompare, Heart, Image as ImageIcon, Menu, MessageCircle, MoreHorizontal, Pencil, Plus, Repeat2, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Star, Trash2, Upload, X } from 'lucide-react';

type Theme = 'auto' | 'light' | 'dark';
type Width = 'standard' | 'large';
interface Appearance { theme: Theme; width: Width }
interface AppearanceCtx { appearance: Appearance; setAppearance: (a: Appearance) => void }

const AppearanceContext = createContext<AppearanceCtx>({
  appearance: { theme: 'auto', width: 'standard' },
  setAppearance: () => {},
});
const useAppearance = () => useContext(AppearanceContext);

/* ─── Lightbox context ───────────────────────────────────────────────────── */

type LightboxEntry = { src: string; alt: string; caption?: string };
const LightboxContext = createContext<{ open: (e: LightboxEntry) => void }>({ open: () => {} });

function LightboxProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<LightboxEntry | null>(null);
  const close = () => setEntry(null);

  useEffect(() => {
    if (!entry) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [entry]);

  return (
    <LightboxContext.Provider value={{ open: setEntry }}>
      {children}
      {entry && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={close}
        >
          {/* Close button */}
          <button
            onClick={close}
            className="absolute top-4 right-5 text-white/70 hover:text-white transition"
            aria-label="Fermer"
          >
            <X size={30} />
          </button>
          {/* Image + caption — click on image doesn't close */}
          <div className="flex flex-col items-center max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={entry.src}
              alt={entry.alt}
              className="max-w-[92vw] max-h-[82vh] object-contain rounded shadow-2xl"
            />
            {entry.caption && (
              <p className="mt-3 text-sm text-white/80 text-center max-w-2xl px-4 leading-relaxed">
                {entry.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </LightboxContext.Provider>
  );
}

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

/**
 * Returns '#ffffff' for dark backgrounds or '#000000' for light ones,
 * using WCAG relative luminance (threshold L = 0.179).
 * Falls back to '#000000' on any parse error.
 */
function getContrastingColor(hex: string): '#ffffff' | '#000000' {
  try {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.179 ? '#000000' : '#ffffff';
  } catch {
    return '#000000';
  }
}

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
  const [location, setLocation] = useLocation();
  const { appearance } = useAppearance();

  /* Hide the entire WikiBase chrome on the home dashboard */
  const isHome = location === '/' || location === '/twitter' || location.startsWith('/twitter/profile/') || location === '/oria' || location === '/instagram';

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) setLocation(`/wiki?q=${encodeURIComponent(query.trim())}`);
  };

  const maxW = appearance.width === 'large' ? 'max-w-[1300px]' : 'max-w-[960px]';

  if (isHome) {
    /* Full-screen dashboard — no header, no padding */
    return <div className="min-h-[100dvh]">{children}</div>;
  }

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-background">
      {/* Top header */}
      <header className="border-b border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background sticky top-0 z-30">
        <div className={`${maxW} mx-auto flex items-center gap-3 px-4 py-2`}>
          {/* Home button */}
          <Link
            href="/"
            title="Retour à l'accueil CaledoraOS"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--wiki-border)] dark:border-border text-muted-foreground hover:bg-[#eaecf0] dark:hover:bg-secondary transition"
          >
            ⌂
          </Link>

          <button className="md:hidden text-muted-foreground" onClick={() => setMobile(!mobile)} aria-label="Menu">
            <Menu size={18} />
          </button>
          <Link href="/wiki" className="flex items-center gap-2 shrink-0">
            <SiteLogo />
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
          <Link href="/" onClick={() => setMobile(false)} className="wiki-link block py-1">⌂ Accueil</Link>
          <Link href="/wiki" onClick={() => setMobile(false)} className="wiki-link block py-1">WikiBase</Link>
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

/* ─── usePages hook ─────────────────────────────────────────────────────── */

/**
 * Async page store hook. Loads from IndexedDB on mount; exposes a `save`
 * helper that updates state + persists without base64 blobs.
 */
function usePages() {
  const [pages, setPagesState] = useState<WikiPage[]>([]);
  const [ready, setReady] = useState(false);
  const reload = async () => {
    const next = await loadPages();
    setPagesState(next);
    setReady(true);
    return next;
  };
  useEffect(() => {
    void reload();
  }, []);
  const setPages = (next: WikiPage[]) => { setPagesState(next); savePages(next); };
  const persistPages = async (next: WikiPage[]) => {
    await savePages(next);
    setPagesState(next);
  };
  return { pages, setPages, persistPages, ready, reload };
}

/* ─── Dashboard ─────────────────────────────────────────────────────────── */

/* ─── CaledoraOS helpers ─────────────────────────────────────────────────── */

/* ─── Dashboard app tile types & components ──────────────────────────────── */

type DashApp = {
  id: string;
  label: string;
  image?: string;           // URL to public image
  imageNode?: React.ReactNode; // raw SVG / custom element instead of <img>
  emoji?: string;           // shown when no image
  bg: string;               // gradient CSS (tile background)
  imgBg?: string;           // override background behind the image (e.g. '#fff')
  imgFit?: 'cover' | 'contain'; // default 'cover'
  imgPad?: boolean;         // add p-2.5 inside the image box
  imgFilter?: string;       // CSS filter applied to <img>
  active: boolean;
  activeBadge?: string;
};

/* Google Maps pin SVG (official multicolour style) */
const MapsPinSvg = (
  <svg viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg" className="w-8 h-auto">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 22 12 22S24 20.25 24 12C24 5.373 18.627 0 12 0z" fill="#EA4335"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 1.98.48 3.845 1.33 5.49L12 0z" fill="#FBBC04"/>
    <path d="M12 0l10.67 17.49A11.96 11.96 0 0024 12C24 5.373 18.627 0 12 0z" fill="#34A853"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
    <circle cx="12" cy="12" r="3.5" fill="#EA4335"/>
  </svg>
);

function AppTile({ app, onClick }: { app: DashApp; onClick: () => void }) {
  const fit = app.imgFit ?? 'cover';
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-2 active:scale-95 transition-transform duration-100 select-none"
    >
      <div
        className="relative w-14 h-14 sm:w-[60px] sm:h-[60px] rounded-[16px] overflow-hidden shadow-xl border border-white/10 group-hover:border-white/40 group-hover:-translate-y-1 transition-all duration-200"
        style={{ background: app.imgBg ?? app.bg }}
      >
        {app.imageNode ? (
          <div className="w-full h-full flex items-center justify-center p-2">
            {app.imageNode}
          </div>
        ) : app.image ? (
          <img
            src={app.image}
            alt={app.label}
            loading="lazy"
            className={`w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${app.imgPad ? 'p-2.5' : ''}`}
            style={app.imgFilter ? { filter: app.imgFilter } : undefined}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[34px]" style={{ background: app.bg }}>
            {app.emoji}
          </div>
        )}
        {app.activeBadge && (
          <div className="absolute top-1 right-1 bg-[#4ade80] text-[#0a1628] text-[8px] font-extrabold px-1.5 py-0.5 rounded-full leading-none shadow">
            {app.activeBadge}
          </div>
        )}
      </div>
      <span className="text-white/70 text-[11px] sm:text-[11.5px] text-center font-medium group-hover:text-white transition-colors leading-tight">{app.label}</span>
    </button>
  );
}

/* Full-screen star field for the dashboard wallpaper */
function DashStars() {
  const stars: [number, number, number, number][] = [
    [3,5,1,0.35],[8,22,1.5,0.5],[14,65,1,0.25],[22,38,1,0.4],[29,12,1.5,0.3],
    [35,80,1,0.45],[42,48,1,0.3],[51,20,1.5,0.5],[57,72,1,0.25],[63,35,1,0.4],
    [70,88,1,0.3],[77,55,1.5,0.45],[83,15,1,0.35],[88,68,1,0.3],[94,42,1.5,0.5],
    [6,90,1,0.2],[18,50,1,0.3],[31,95,1.5,0.35],[45,8,1,0.4],[59,85,1,0.25],
    [72,28,1,0.45],[86,75,1.5,0.3],[11,33,1,0.35],[26,78,1,0.4],[67,60,1.5,0.3],
    [79,18,1,0.45],[91,50,1,0.3],[4,45,1.5,0.25],[38,92,1,0.4],[55,40,1,0.35],
  ];
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {stars.map(([x, y, r, o], i) => <circle key={i} cx={x} cy={y} r={r * 0.35} fill="white" opacity={o} />)}
    </svg>
  );
}

function Dashboard() {
  const [, navigate] = useLocation();
  const { pages, reload } = usePages();
  const { appearance, setAppearance } = useAppearance();

  const [now, setNow] = useState(new Date());
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [backupAt, setBackupAt] = useState<string | null>(() => getLastPagesBackupAt());
  const [backupBusy, setBackupBusy] = useState<'export' | 'import' | null>(null);
  const [backupNotice, setBackupNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const active = pages.filter((p) => !p.isTrashed);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateStr = (() => {
    const s = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const exportAllPages = async () => {
    setBackupBusy('export');
    setBackupNotice(null);
    try {
      const backup = await createPagesBackup();
      downloadPagesBackup(backup);
      setBackupAt(backup.exportedAt);
      setBackupNotice({ kind: 'success', message: `${backup.pages.length} page${backup.pages.length !== 1 ? 's' : ''} exportée${backup.pages.length !== 1 ? 's' : ''}.` });
    } catch (error) {
      setBackupNotice({ kind: 'error', message: error instanceof Error ? error.message : 'La sauvegarde n’a pas pu être créée.' });
    } finally {
      setBackupBusy(null);
    }
  };

  const importPages = async (file?: File) => {
    if (!file) return;
    setBackupBusy('import');
    setBackupNotice(null);
    try {
      const pages = await restorePagesBackup(JSON.parse(await file.text()) as unknown);
      await reload();
      setBackupNotice({ kind: 'success', message: `${pages.length} page${pages.length !== 1 ? 's' : ''} restaurée${pages.length !== 1 ? 's' : ''}.` });
    } catch (error) {
      setBackupNotice({ kind: 'error', message: error instanceof Error ? error.message : 'Le fichier n’est pas une sauvegarde WikiBase valide.' });
    } finally {
      setBackupBusy(null);
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  const backupIsStale = !backupAt || Date.now() - new Date(backupAt).getTime() > 7 * 24 * 60 * 60 * 1000;
  const backupDate = backupAt ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(backupAt)) : null;

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
  const img = (f: string) => `${BASE}/images/${f}`;

  const apps: DashApp[] = [
    // WikiBase — white bg so the dark W logo is visible
    { id: 'wikibase',  label: 'WikiBase',        image: img('site_logo.png'),  imgBg: '#ffffff', imgFit: 'contain', imgPad: true,  bg: '#ffffff', active: true,  activeBadge: active.length > 0 ? 'Actif' : undefined },
    // Instagram — image covers tile naturally (gradient logo)
    { id: 'instagram', label: 'Instagram',        image: img('Instagram.png'),  bg: 'linear-gradient(145deg,#833ab4,#fd1d1d)', active: true },
    // Twitter/X — black logo → invert to white, keep dark tile
    { id: 'twitter',   label: 'Twitter / X',      image: img('XLogo.png'),      bg: 'linear-gradient(145deg,#111827,#1f2937)', imgFit: 'contain', imgPad: true, imgFilter: 'brightness(0) invert(1)', active: true },
    // CFC Official
    { id: 'cfc',       label: 'CFC Official',     image: img('logo1.png'),      bg: 'linear-gradient(145deg,#1e3a8a,#2563eb)', imgFit: 'contain', imgPad: true,  active: false },
    // Caledora Airways
    { id: 'airways',   label: 'Caledora Airways', image: img('airways2.jpg'),   bg: 'linear-gradient(145deg,#0c4a6e,#0369a1)', imgFit: 'cover', active: true  },
    // Oria Bank — white bg + padding so logo doesn't get cropped
    { id: 'bank',      label: 'Oria Bank',        image: img('oriabank.png'),   imgBg: '#ffffff', imgFit: 'contain', imgPad: true,  bg: '#ffffff', active: true },
    // Maps — custom Google Maps pin SVG
    { id: 'maps',      label: 'Maps',             imageNode: MapsPinSvg,        bg: '#ffffff',    imgBg: '#ffffff',  active: false },
    // Paramètres
    { id: 'settings',  label: 'Paramètres',       emoji: '⚙️',                  bg: 'linear-gradient(145deg,#374151,#6b7280)', active: true  },
    { id: 'backup',    label: 'Import / Export',  emoji: '⇅',                   bg: 'linear-gradient(145deg,#0d5c66,#22a0a9)', active: true  },
  ];

  const handleApp = (app: DashApp) => {
    if (!app.active) { setComingSoon(app.label); return; }
    if (app.id === 'wikibase')  navigate('/wiki');
    if (app.id === 'instagram') navigate('/instagram');
    if (app.id === 'twitter')   navigate('/twitter');
    if (app.id === 'airways')   { window.location.href = '/airways/'; return; }
    if (app.id === 'bank')      { window.location.href = '/oria'; return; }
    if (app.id === 'settings')  setShowSettings(true);
    if (app.id === 'backup')    navigate('/sauvegarde');
  };

  const glass: React.CSSProperties = {
    background: 'rgba(255,255,255,0.10)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.13)',
  };

  return (
    <div
      className="relative w-full h-screen max-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #060c1a 0%, #0c1c38 45%, #060e1f 100%)' }}
    >
      {/* Background star field */}
      <DashStars />

      {/* ── TOP HUD ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-6 px-6 sm:px-12 lg:px-20 pt-10 sm:pt-14 pb-6">

        {/* Clock + date */}
        <div className="select-none">
          <div
            className="text-white font-extralight leading-none"
            style={{ fontSize: 'clamp(72px, 14vw, 128px)', letterSpacing: -4 }}
          >
            {timeStr}
          </div>
          <div className="text-white/45 text-lg sm:text-xl mt-3 font-light">{dateStr}</div>
        </div>

        {/* Widgets */}
        <div className="flex flex-row sm:flex-col gap-3 sm:pt-2">

          {/* Weather */}
          <div className="rounded-2xl px-5 py-4 text-white flex items-center gap-4 flex-1 sm:flex-none sm:min-w-[220px]" style={glass}>
            <div className="text-[36px] leading-none">☀️</div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">Météo · Caledora City</div>
              <div className="text-2xl font-bold leading-none">24°C</div>
              <div className="text-[12px] text-white/55 mt-1">Ensoleillé</div>
            </div>
          </div>

          {/* Match */}
          <div className="rounded-2xl px-5 py-4 text-white flex-1 sm:flex-none sm:min-w-[220px]" style={glass}>
            <div className="text-[10px] text-white/40 uppercase tracking-widest mb-3">⚽ Prochain Match</div>
            <div className="flex items-center gap-3 mb-3">
              {/* CFC */}
              <div className="flex flex-col items-center gap-1">
                <img src={img('logo1.png')} alt="Caledora FC" className="w-9 h-9 object-contain" />
                <span className="text-[9px] text-white/50">CFC</span>
              </div>
              <div className="text-white/30 font-bold text-base px-1">vs</div>
              {/* Arsenal — official badge via Wikimedia */}
              <div className="flex flex-col items-center gap-1">
                <img
                  src="https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg"
                  alt="Arsenal FC"
                  className="w-9 h-9 object-contain"
                />
                <span className="text-[9px] text-white/50">Arsenal</span>
              </div>
            </div>
            <div className="text-[10px] text-white/35 mb-1.5">Caledora Mare Stadium</div>
            <div className="rounded-xl bg-white/10 px-2 py-1 text-center text-[11px] font-semibold">Samedi · 20:45</div>
          </div>
        </div>
      </div>

      {/* ── APP GRID ────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 sm:px-12 lg:px-20 pb-14">
        <div className="grid grid-cols-4 gap-6 sm:gap-10 lg:gap-14 w-full max-w-2xl">
          {apps.map((app) => (
            <AppTile key={app.id} app={app} onClick={() => handleApp(app)} />
          ))}
        </div>
      </div>

      {/* ── PAGE BACKUP ─────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto mb-5 w-[calc(100%-3rem)] max-w-2xl rounded-2xl px-4 py-3 text-white sm:mb-7 sm:px-5" style={glass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            {backupIsStale ? <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-300" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-300" />}
            <div className="min-w-0">
              <div className="text-[12px] font-semibold">{backupIsStale ? 'Aucune sauvegarde récente' : `Sauvegarde du ${backupDate}`}</div>
              <div className="mt-0.5 text-[11px] leading-4 text-white/50">{backupIsStale ? 'Protégez vos pages avant de vider le cache du navigateur.' : 'Vos pages sont protégées par un fichier JSON exporté.'}</div>
              {backupNotice && <div role="status" className={`mt-1 text-[11px] ${backupNotice.kind === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>{backupNotice.message}</div>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button onClick={() => void exportAllPages()} disabled={backupBusy !== null} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-[#102342] transition hover:bg-white/90 disabled:opacity-50">
              <Download size={14} /> {backupBusy === 'export' ? 'Export…' : 'Exporter toutes les pages'}
            </button>
            <button onClick={() => backupInputRef.current?.click()} disabled={backupBusy !== null} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-50">
              <Upload size={14} /> {backupBusy === 'import' ? 'Import…' : 'Importer une sauvegarde'}
            </button>
            <input ref={backupInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importPages(event.target.files?.[0])} />
          </div>
        </div>
      </div>

      {/* ── COMING SOON MODAL ───────────────────────────────────── */}
      {comingSoon && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          onClick={() => setComingSoon(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-8 text-center text-white shadow-2xl"
            style={{ background: 'rgba(10,20,40,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-6xl mb-4">🚀</div>
            <div className="font-bold text-[20px] mb-2">{comingSoon}</div>
            <div className="text-[14px] text-white/55 leading-relaxed mb-6">
              Service en cours de déploiement<br/>dans la <strong className="text-white/75">République de Caledora</strong>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-[12px] text-white/45 mb-6" style={{ background: 'rgba(255,255,255,0.07)' }}>
              ⏳ Bientôt disponible — Caledora Digital Services
            </div>
            <br />
            <button onClick={() => setComingSoon(null)} className="text-[12px] text-white/25 hover:text-white/50 transition underline">Fermer</button>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ──────────────────────────────────────── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-8 text-white shadow-2xl"
            style={{ background: 'rgba(10,20,40,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold text-[18px]">Paramètres</span>
              <button onClick={() => setShowSettings(false)} className="text-white/35 hover:text-white transition"><X size={20} /></button>
            </div>

            <div className="mb-5">
              <div className="text-[11px] text-white/35 uppercase tracking-widest mb-3">Apparence</div>
              <div className="flex gap-2">
                {(['auto', 'light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAppearance({ ...appearance, theme: t })}
                    className={`flex-1 py-2.5 rounded-2xl text-[13px] font-medium transition-all ${appearance.theme === t ? 'bg-primary text-white shadow' : 'text-white/50 hover:text-white/80 hover:bg-white/10'}`}
                    style={appearance.theme !== t ? { background: 'rgba(255,255,255,0.07)' } : undefined}
                  >
                    {t === 'auto' ? '🔄 Auto' : t === 'light' ? '☀️ Clair' : '🌙 Sombre'}
                  </button>
                ))}
              </div>
            </div>

            <Link
              href="/sauvegarde"
              onClick={() => setShowSettings(false)}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left transition hover:bg-white/[0.12]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#22a0a9]/20 text-lg text-[#8ee8ea]">⇅</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-white/85">Import / Export</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-white/40">Sauvegarder ou restaurer vos données</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-white/35" />
            </Link>

            <div className="border-t border-white/10 pt-5 space-y-1 text-[12px] text-white/25">
              <div>CaledoraOS · Version 1.0</div>
              <div>WikiBase · {active.length} article{active.length !== 1 ? 's' : ''} en base</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── WikiList ───────────────────────────────────────────────────────────── */

function WikiList() {
  const [location] = useLocation();
  const qs = new URLSearchParams(location.includes('?') ? location.split('?')[1] : '');
  const { pages, setPages } = usePages();
  const [query, setQuery] = useState(qs.get('q') ?? '');
  const [filter, setFilter] = useState('Toutes');

  const active = pages.filter((p) => !p.isTrashed);
  const categories = ['Toutes', ...Array.from(new Set(active.map((p) => p.category)))];
  const normalizedQuery = normalizeStr(query);
  const visible = active.filter(
    (p) => (
      normalizeStr(allText(p)).includes(normalizedQuery) ||
      p.aliases.some((alias) => normalizeStr(alias).includes(normalizedQuery))
    ) && (filter === 'Toutes' || p.category === filter)
  );

  return (
    <div className="animate-rise">
      {/* Header row */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-sm">{active.length} article{active.length !== 1 ? 's' : ''}</span>
        </div>
        <Link href="/create" className="ml-auto inline-flex items-center gap-1 wiki-link text-sm">
          <Plus size={13} /> Nouvel article
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block max-w-md flex-1">
          <Search className="absolute left-2.5 top-2 text-muted-foreground" size={14} />
          <input
            data-testid="input-search-pages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer les pages…"
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

      {visible.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
                      <span>{page.category}</span><span>·</span>
                      <span>{page.type}</span><span>·</span>
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
          <div className="wiki-infobox-header" style={{ background: color, color: getContrastingColor(color) }}>{page.title}</div>
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
    loadPages().then((existing) => {
      const next = [...existing.filter((p) => p.id !== parsed.id), { ...parsed, accentColor }];
      savePages(next);
      setLocation(`/page/${parsed.id}`);
    });
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
  const [activeH2Idx, setActiveH2Idx] = useState<number>(-1);
  const numbers = computeTocNumbers(sections);

  /**
   * Pre-compute parentH2[i] = index of the nearest H2 ancestor for section i.
   * If section i IS an H2, parentH2[i] === i.
   * If no H2 has been seen yet, parentH2[i] === -1.
   */
  const parentH2 = useMemo(() => {
    let currentH2 = -1;
    return sections.map((s) => {
      if (s.level === 2) currentH2 = sections.indexOf(s);
      return currentH2;
    });
  }, [sections]);

  /**
   * ScrollSpy — reliable "last heading above reading line" strategy.
   *
   * Instead of IntersectionObserver (which loses track when the heading has
   * scrolled above the viewport and no section title is currently visible),
   * we listen to scroll events and find the last section element whose top
   * edge is at or above the reading threshold (120 px from the viewport top).
   * That index is mapped to its parent H2 via parentH2[].
   */
  useEffect(() => {
    if (sections.length === 0) return;
    const THRESHOLD = 120; // px from top of viewport

    const update = () => {
      let bestIdx = -1;
      for (let i = 0; i < sections.length; i++) {
        const el = document.getElementById(`section-${i}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= THRESHOLD) bestIdx = i;
      }
      setActiveH2Idx(bestIdx >= 0 ? parentH2[bestIdx] : -1);
    };

    // `document` captures scroll on any scrollable ancestor, incl. body / html.
    document.addEventListener('scroll', update, { passive: true });
    update(); // initial paint
    return () => document.removeEventListener('scroll', update);
  }, [sections, parentH2]);

  /* Smooth-scroll to section on click */
  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, idx: number) => {
    e.preventDefault();
    const el = document.getElementById(`section-${idx}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveH2Idx(idx);
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
                className={['wiki-toc-item', activeH2Idx === i ? 'wiki-toc-item--active' : ''].filter(Boolean).join(' ')}
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

/* ─── Medal icons ────────────────────────────────────────────────────────── */

const MEDAL_CONFIG = {
  or:      { fill: '#FFD700', stroke: '#B8960C', label: 'Médaille d\'or' },
  argent:  { fill: '#C0C0C0', stroke: '#808080', label: 'Médaille d\'argent' },
  bronze:  { fill: '#CD7F32', stroke: '#8C5A1E', label: 'Médaille de bronze' },
} as const;

type MedalType = keyof typeof MEDAL_CONFIG;

/** Circular medal icon, inline-aligned, purely SVG — no external dependency. */
function MedalIcon({ type }: { type: MedalType }) {
  const { fill, stroke, label } = MEDAL_CONFIG[type];
  return (
    <span title={label} aria-label={label} style={{ display: 'inline-block', lineHeight: 1 }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        width="15"
        height="15"
        className="inline-block shrink-0"
        aria-hidden="true"
        style={{ verticalAlign: '-0.15em', marginInline: '0.15em' }}
      >
        {/* SVG title for screen readers / tooltip fallback */}
        <title>{label}</title>
        {/* Medal body */}
        <circle cx="8" cy="8" r="7" fill={fill} stroke={stroke} strokeWidth="1.2" />
        {/* Subtle shine */}
        <ellipse cx="6.2" cy="5.4" rx="2.4" ry="1.4" fill="white" fillOpacity="0.28" />
      </svg>
    </span>
  );
}

/**
 * Inline flag image.
 * Strategy: try public/flags/{code}.png first (supports custom/fictional flags).
 * If the image fails to load, fall back to the bundled flag-icons CSS class.
 */
function FlagImg({ code }: { code: string }) {
  const [useCss, setUseCss] = useState(false);
  const src = `${import.meta.env.BASE_URL}flags/${code}.png`;
  if (useCss) {
    return (
      <span
        className={`fi fi-${code} inline-flag`}
        title={code.toUpperCase()}
        aria-label={`Drapeau ${code.toUpperCase()}`}
        role="img"
      />
    );
  }
  return (
    <img
      src={src}
      onError={() => setUseCss(true)}
      className="inline-block object-cover"
      style={{ height: '0.875rem', width: '1.3rem', verticalAlign: '-0.12em', marginInline: '0.1em' }}
      alt={`Drapeau ${code.toUpperCase()}`}
      title={code.toUpperCase()}
    />
  );
}

/** Convert a 2-letter ISO country code to its flag emoji (for {{flag:xx}} syntax). */
function flagEmoji(code: string): string {
  return code.toUpperCase().split('').map((c) =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('');
}

/** Find a page by title (exact, case-insensitive) then by aliases (accent+case insensitive). */
function resolvePage(name: string, pages: WikiPage[]): WikiPage | undefined {
  const norm = normalizeStr(name);
  return (
    pages.find((p) => normalizeStr(p.title) === norm) ??
    pages.find((p) => p.aliases.some((a) => normalizeStr(a) === norm))
  );
}

function InternalText({ text, pages }: { text: string; pages: WikiPage[] }) {
  // Matches: [[Wiki links]] (with optional |display text), {{flag:xx}} (emoji), [flag: gb-eng] (image), {{or/argent/bronze}} (medals)
  const parts = text.split(/(\[\[[^\]]+\]\]|\{\{flag:[a-zA-Z]{2,3}\}\}|\[flag:\s*[a-zA-Z0-9-]+\]|\{\{(?:or|argent|bronze)\}\})/gi);
  return (
    <>
      {parts.map((part, i) => {
        // [[Target]] or [[Target|Display text]]
        const wikiMatch = part.match(/^\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/);
        if (wikiMatch) {
          const targetName = wikiMatch[1].trim();
          const displayText = wikiMatch[2]?.trim() || targetName;
          const target = resolvePage(targetName, pages);
          return target
            ? <Link data-testid={`link-internal-${targetName}`} key={i} href={`/page/${target.id}`} className="wiki-link">{displayText}</Link>
            : <span data-testid={`link-missing-${targetName}`} key={i} className="wiki-link-red">{displayText}</span>;
        }
        // {{flag:xx}} → emoji
        const flagEmojiMatch = part.match(/^\{\{flag:([a-zA-Z]{2,3})\}\}$/);
        if (flagEmojiMatch) {
          const code = flagEmojiMatch[1];
          return <span key={i} title={code.toUpperCase()} aria-label={`Drapeau ${code.toUpperCase()}`}>{flagEmoji(code)}</span>;
        }
        // [flag: xx] → tries public/flags/xx.png first, falls back to flag-icons CSS
        const flagImgMatch = part.match(/^\[flag:\s*([a-zA-Z0-9-]+)\]$/);
        if (flagImgMatch) {
          const code = flagImgMatch[1].toLowerCase();
          return <FlagImg key={i} code={code} />;
        }
        // {{or}}, {{argent}}, {{bronze}} → inline medal SVG
        const medalMatch = part.match(/^\{\{(or|argent|bronze)\}\}$/i);
        if (medalMatch) {
          const type = medalMatch[1].toLowerCase() as MedalType;
          return <MedalIcon key={i} type={type} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/**
 * Site logo shown in the top-left header.
 * Tries public/images/site_logo.png first; falls back to the SVG "W" monogram.
 * In dark mode, applies brightness-0 + invert so a dark logo turns white.
 */
function SiteLogo() {
  const [failed, setFailed] = useState(false);
  const src = `${import.meta.env.BASE_URL}images/site_logo.png`;
  if (failed) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary overflow-hidden shrink-0">
        <svg viewBox="0 0 60 60" className="h-7 w-7" aria-hidden>
          <circle cx="30" cy="30" r="28" fill="transparent" stroke="#a2a9b1" strokeWidth="2" />
          <text x="30" y="38" textAnchor="middle" fontSize="28" fontFamily="Georgia,serif" fill="currentColor" fontWeight="bold">W</text>
        </svg>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="WikiBase"
      className="h-8 w-auto object-contain shrink-0 dark:brightness-0 dark:invert"
      onError={() => setFailed(true)}
    />
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
  if (jersey.image) {
    const src = resolveImageSrc(jersey.image);
    return (
      <div className="infobox-jersey-kit">
        {src
          ? <img src={src} className="w-9 h-11 object-contain" alt={jersey.image.alt || jersey.name} />
          : <LogoPlaceholder initial={jersey.name[0]?.toUpperCase() ?? '?'} color={jersey.colors[0] ?? '#72777d'} />}
        <span className="infobox-jersey-label">{jersey.name}</span>
      </div>
    );
  }
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

/* ─── Infobox row grouping ───────────────────────────────────────────────── */

type GroupedRow =
  | { kind: 'kv'; key: string; value: string }
  | { kind: 'banner'; label: string }
  | { kind: 'jerseys'; items: Array<{ label: string; value: string }> };

/** Label mapping for common jersey key names. */
const JERSEY_LABELS: Record<string, string> = {
  domicile: 'Domicile',
  exterieur: 'Extérieur',
  extérieur: 'Extérieur',
  third: 'Third',
};

/**
 * Groups raw KV rows into typed display rows:
 * - lines without '=' whose key matches `[section: Label]` → banner with label stripped
 * - lines without '=' whose key matches `[maillot_xxx: colors]` → jersey group
 * - other lines without '=' → plain accent banner
 * - normal KV rows → kv
 */
function groupInfoboxRows(rows: { key: string; value: string }[]): GroupedRow[] {
  const result: GroupedRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    if (r.value !== '') {
      result.push({ kind: 'kv', key: r.key, value: r.value });
      i++;
      continue;
    }
    const key = r.key.trim();

    // [section: Label] → plain banner, brackets stripped
    const sectionMatch = key.match(/^\[section:\s*(.+?)\]$/i);
    if (sectionMatch) {
      result.push({ kind: 'banner', label: sectionMatch[1].trim() });
      i++;
      continue;
    }

    // [maillot_xxx: ...] — collect consecutive jersey rows into one group
    const jerseyMatch = key.match(/^\[maillot_(\w+):\s*(.+?)\]$/i);
    if (jerseyMatch) {
      const jerseys: Array<{ label: string; value: string }> = [];
      while (i < rows.length) {
        const jr = rows[i];
        if (jr.value !== '') break;
        const jm = jr.key.trim().match(/^\[maillot_(\w+):\s*(.+?)\]$/i);
        if (!jm) break;
        const rawLabel = jm[1].toLowerCase();
        const label = JERSEY_LABELS[rawLabel]
          ?? (rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1));
        jerseys.push({ label, value: jm[2].trim() });
        i++;
      }
      result.push({ kind: 'jerseys', items: jerseys });
      continue;
    }

    // Plain text → accent-colored banner
    result.push({ kind: 'banner', label: key });
    i++;
  }
  return result;
}

/** A titled sub-section of key-value rows within the infobox. */
function InfoboxSection({ section, pages, accentColor }: { section: WBInfoboxSection; pages: WikiPage[]; accentColor: string }) {
  const textColor = getContrastingColor(accentColor);
  return (
    <>
      <div
        className="infobox-section-title"
        style={{ background: accentColor, color: textColor }}
      >
        {section.title}
      </div>
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
  const { open: openLightbox } = useContext(LightboxContext);
  const accentColor = page.accentColor ?? categoryColor(page.category);
  const headerTextColor = getContrastingColor(accentColor);
  const infoboxImage = getDisplayInfoboxImage(page);
  return (
    <aside data-testid="content-infobox" className="wiki-infobox w-full lg:float-right lg:clear-right lg:ml-5 lg:mb-4 lg:w-[280px] lg:shrink-0 mb-4">
      <div className="wiki-infobox-header" style={{ background: accentColor, color: headerTextColor }}>{page.title}</div>

      {/* Optional image */}
      {infoboxImage && (
        <div className="flex items-center justify-center border-b border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-muted py-2 text-center text-xs text-muted-foreground overflow-hidden" style={{ minHeight: 140 }}>
          {resolveImageSrc(infoboxImage)
            ? <img
                src={resolveImageSrc(infoboxImage)}
                alt={infoboxImage.alt}
                className="max-h-40 max-w-full object-contain cursor-zoom-in"
                onClick={() => {
                  const src = resolveImageSrc(infoboxImage);
                  if (src) openLightbox({ src, alt: infoboxImage.alt, caption: infoboxImage.caption });
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.removeAttribute('hidden');
                }}
              />
            : null
          }
          {/* Placeholder shown when img fails or no src */}
          <span hidden={!!resolveImageSrc(infoboxImage)}>
            <LogoPlaceholder initial={page.title[0]?.toUpperCase() ?? '?'} color={accentColor} />
          </span>
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
        {groupInfoboxRows(page.infobox).map((row, i) => {
          if (row.kind === 'kv') return (
            <div key={i} className="grid grid-cols-[44%_56%] border-b border-[var(--wiki-border)] dark:border-border py-1 px-1 text-xs last:border-0">
              <span className="font-bold">{row.key}</span>
              <span><InternalText text={row.value} pages={pages} /></span>
            </div>
          );

          if (row.kind === 'banner') return (
            <div
              key={i}
              className="text-center font-bold text-xs py-1 px-2"
              style={{ background: accentColor, color: headerTextColor }}
            >
              {row.label}
            </div>
          );

          /* row.kind === 'jerseys' */
          return (
            <div key={i} className="py-2 px-2 border-b border-[var(--wiki-border)] dark:border-border last:border-0">
              <div className="infobox-jerseys-row">
                {row.items.map((item) => {
                  const isPath = /\.(png|jpg|jpeg|svg|webp)$/i.test(item.value);
                  if (isPath) return (
                    <div key={item.label} className="infobox-jersey-kit">
                      <img
                        src={`${import.meta.env.BASE_URL}${item.value.trim()}`}
                        className="w-9 h-auto"
                        alt={item.label}
                      />
                      <span className="infobox-jersey-label">{item.label}</span>
                    </div>
                  );
                  const colors = item.value.split(',').map((s) => s.trim()).filter(Boolean);
                  return <JerseyKit key={item.label} jersey={{ name: item.label, colors }} />;
                })}
              </div>
            </div>
          );
        })}

        {/* Optional sub-sections — only rendered when [INFOBOX_SECTION] blocks are in the source */}
        {page.infoboxSections?.map((s) => (
          <InfoboxSection key={s.title} section={s} pages={pages} accentColor={accentColor} />
        ))}
      </div>
    </aside>
  );
}

/**
 * Resolve the display URL for a WBImage.
 *
 * Priority:
 *  1. blob URL from the current session (set by the file-picker, never saved)
 *  2. filename treated as an app-root-relative path, correctly prefixed with
 *     import.meta.env.BASE_URL so it works on Replit (/wikibase/) and locally (/)
 *
 * Examples (BASE_URL = "/wikibase/"):
 *   "images/logo.png"   → "/wikibase/images/logo.png"   ✅
 *   "/images/logo.png"  → "/wikibase/images/logo.png"   ✅
 *   "https://…"         → unchanged                      ✅
 */
function resolveImageSrc(img: WBImage): string | undefined {
  if (img.src) return img.src;
  const f = img.filename.trim();
  if (!f) return undefined;
  // Absolute URLs and data URIs pass through unchanged
  if (/^(https?:\/\/|data:|\/\/)/.test(f)) return f;
  // Persistent media paths are served by the shared API, outside the Vite base
  // path. Keep the canonical identifier intact after an IndexedDB reload.
  if (/^\/api\/images\//.test(f)) return f;
  // Strip any leading slashes so we never double them
  const clean = f.replace(/^\/+/, '');
  // BASE_URL always ends with "/" (guaranteed by Vite)
  return import.meta.env.BASE_URL + clean;
}

function BlockView({ block, pages }: { block: WBBlock; pages: WikiPage[] }) {
  const { open: openLightbox } = useContext(LightboxContext);
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
    const src = resolveImageSrc(img);
    const pos = (img.alignment || 'droite').toLowerCase();
    const floatClass = pos === 'gauche'
      ? 'float-left clear-left mr-4 mb-3 max-w-[280px] sm:max-w-[320px]'
      : pos === 'centre'
      ? 'mx-auto my-4 block clear-both max-w-full text-center'
      : 'float-right clear-right ml-4 mb-3 max-w-[280px] sm:max-w-[320px]';
    return (
      <figure
        data-testid={`image-block-${img.filename}`}
        className={`${floatClass} border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-secondary p-1`}
      >
        <div
          className={`flex items-center justify-center overflow-hidden bg-[#eaecf0] dark:bg-muted text-xs text-muted-foreground${src ? ' cursor-zoom-in' : ''}`}
          onClick={src ? () => openLightbox({ src, alt: img.alt, caption: img.caption || img.filename }) : undefined}
        >
          {src
            ? <img src={src} alt={img.alt} className="max-w-full object-contain block" />
            : <div className="flex items-center gap-1 py-8 px-4"><ImageIcon size={14} />Image manquante</div>
          }
        </div>
        {(img.caption || img.filename) && (
          <figcaption className="pt-1 px-1 text-[11px] text-center text-muted-foreground leading-relaxed">
            {img.caption || img.filename}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.type === 'gallery') {
    return (
      <div
        data-testid="gallery-block"
        className="my-4 clear-both grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      >
        {block.images.map((img, index) => {
          const src = resolveImageSrc(img);
          const label = img.caption || img.filename;
          return (
            <figure
              data-testid={`gallery-item-${index}`}
              key={`${img.filename}-${index}`}
              className="min-w-0 border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-secondary p-1"
            >
              <div
                className={`flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#eaecf0] dark:bg-muted text-xs text-muted-foreground${src ? ' cursor-zoom-in' : ''}`}
                onClick={src ? () => openLightbox({ src, alt: img.alt, caption: label }) : undefined}
              >
                {src
                  ? <img src={src} alt={img.alt} className="h-full w-full object-contain block" />
                  : <div className="flex flex-col items-center gap-1 px-2 py-6 text-center"><ImageIcon size={14} />Image manquante</div>
                }
              </div>
              <figcaption className="pt-1 px-1 text-[11px] text-center text-muted-foreground leading-relaxed break-words">
                {label}
              </figcaption>
            </figure>
          );
        })}
      </div>
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
  const previewSrc = resolveImageSrc(image);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
  }, [previewSrc]);

  const pickFile = async (file?: File) => {
    if (!file) return;
    if (uploading) return;
    const validImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const validExtension = /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!validImageTypes.has(file.type) && !validExtension) {
      setUploadError('Choisissez une image PNG, JPG ou WEBP.');
      return;
    }
    setUploading(true); setUploadError('');
    try {
      const uploaded = await uploadMedia(file, 'wikibase');
      onChange({ ...image, filename: uploaded.path, src: undefined, missing: false });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Import impossible.');
    } finally {
      setUploading(false);
    }
  };
  const set = (key: keyof WBImage, value: string) => onChange({
    ...image,
    [key]: value,
    ...(key === 'filename' ? { src: undefined, missing: !value.trim() } : {}),
  });

  return (
    <div
      data-testid={`dropzone-image-${label}`}
      className={`rounded border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-secondary p-3 transition-colors ${dragging ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!uploading) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void pickFile(event.dataTransfer.files?.[0]);
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2"><ImageIcon size={14} className="text-primary" /><span className="text-sm font-bold truncate">{label}</span></div>
        <button data-testid={`button-delete-image-${label}`} onClick={onDelete} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
      </div>

      {/* Live preview */}
      <div className="mb-2 flex h-24 items-center justify-center rounded border border-[var(--wiki-border)] dark:border-border bg-[#eaecf0] dark:bg-muted overflow-hidden text-xs text-muted-foreground">
        {previewSrc && !previewFailed
          ? <img
              src={previewSrc}
              alt={image.alt || label}
              className="max-h-full max-w-full object-contain"
              onError={() => {
                setPreviewFailed(true);
              }}
            />
          : <span className="flex flex-col items-center gap-1 text-center px-3"><ImageIcon size={18} className="opacity-40" />{image.filename ? 'Image introuvable' : 'Aucune image'}</span>
        }
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-bold col-span-full">
          Chemin du fichier
          <input
            data-testid={`input-image-file-${label}`}
            value={image.filename}
            onChange={(e) => set('filename', e.target.value)}
            placeholder="images/mon-logo.png"
            className="mt-1 h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background px-2 text-xs font-normal font-mono"
          />
          <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
            Utilisez le bouton ci-dessous pour l’enregistrer dans la médiathèque partagée.
          </span>
        </label>
        <label className="text-xs font-bold">Légende<input data-testid={`input-image-caption-${label}`} value={image.caption} onChange={(e) => set('caption', e.target.value)} className="mt-1 h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background px-2 text-xs font-normal" /></label>
        <label className="text-xs font-bold">Texte alt<input data-testid={`input-image-alt-${label}`} value={image.alt} onChange={(e) => set('alt', e.target.value)} className="mt-1 h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background px-2 text-xs font-normal" /></label>
        <div className="grid grid-cols-2 gap-1">
          <label className="text-xs font-bold">Alignement<select data-testid={`select-image-alignment-${label}`} value={image.alignment} onChange={(e) => set('alignment', e.target.value)} className="mt-1 h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background px-2 text-xs font-normal"><option>gauche</option><option>centre</option><option>droite</option></select></label>
          <label className="text-xs font-bold">Taille<input data-testid={`input-image-size-${label}`} value={image.size} onChange={(e) => set('size', e.target.value)} className="mt-1 h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background px-2 text-xs font-normal" /></label>
        </div>
      </div>

      <label className={`mt-2 flex cursor-pointer items-center justify-center rounded border border-dashed border-primary/40 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
        <Upload size={12} className="mr-1" /> {uploading ? 'Import en cours…' : dragging ? 'Déposez l’image ici' : 'Déposer une image ou parcourir'}
        <input data-testid={`input-replace-image-${label}`} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={(e) => { void pickFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      </label>
      {uploadError && <p className="mt-1 text-[10px] text-destructive">{uploadError}</p>}
    </div>
  );
}

function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const { pages, setPages, ready } = usePages();
  const page = pages.find((p) => p.id === id) ?? pages[0];
  const [, setLocation] = useLocation();

  const remove = () => {
    if (!window.confirm('Déplacer cette page dans la corbeille ?')) return;
    const next = pages.map((p) => p.id === page.id ? { ...p, isTrashed: true, updatedAt: new Date().toISOString() } : p);
    setPages(next); setLocation('/');
  };

  if (!ready) return <div className="animate-rise p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (!page) return <div className="animate-rise p-6 text-sm text-muted-foreground">Page introuvable.</div>;

  return (
    <div className="animate-rise">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground mb-2">
        <Link href="/wiki" className="wiki-link">Accueil</Link>
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

      {/* Mobile-only: infobox appears right after the header, before TOC and intro */}
      <div className="lg:hidden">
        <Infobox page={page} pages={pages} />
      </div>

      {/* Two-column layout: TOC sidebar + article body */}
      <div className="reader-layout">
        <TableOfContents sections={page.sections} />

        <div className="reader-main" data-testid="article-page-content">
        <div className="article-body clearfix" style={{ '--page-accent': page.accentColor ?? categoryColor(page.category) } as React.CSSProperties}>
        {/* Desktop-only: infobox floats right inside the article body */}
        <div className="hidden lg:block">
          <Infobox page={page} pages={pages} />
        </div>

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
            <div className="flow-root space-y-2">
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

const editInputClass = 'mt-1 h-8 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-2 text-xs font-normal';
const editTextareaClass = 'mt-1 min-h-16 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary p-2 text-sm font-normal leading-5';
const editCardClass = 'rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-card p-4';

function EditorActions({ onUp, onDown, onDelete, canUp = true, canDown = true, label }: {
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
  canUp?: boolean;
  canDown?: boolean;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-start gap-1">
      {onUp && <button type="button" aria-label={`Monter ${label}`} title={`Monter ${label}`} disabled={!canUp} onClick={onUp} className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"><ArrowUp size={13} /></button>}
      {onDown && <button type="button" aria-label={`Descendre ${label}`} title={`Descendre ${label}`} disabled={!canDown} onClick={onDown} className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"><ArrowDown size={13} /></button>}
      <button type="button" aria-label={`Supprimer ${label}`} title={`Supprimer ${label}`} onClick={onDelete} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
    </div>
  );
}

function ListBlockEditor({ block, onChange }: { block: Extract<WBBlock, { type: 'list' | 'numbered' }>; onChange: (block: WBBlock) => void }) {
  const updateItems = (items: string[]) => onChange({ ...block, items });
  return (
    <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold">{block.type === 'numbered' ? 'Liste numérotée' : 'Liste à puces'}</span>
        <button type="button" data-testid="button-add-list-item" onClick={() => updateItems([...block.items, ''])} className="wiki-link inline-flex items-center gap-1 text-xs"><Plus size={12} /> Ajouter un élément</button>
      </div>
      {block.items.length === 0 && <p className="mb-2 text-xs text-muted-foreground">Cette liste est vide. Ajoutez un élément pour la remplir.</p>}
      <div className="space-y-1.5">
        {block.items.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-2 w-5 text-center text-xs text-muted-foreground">{block.type === 'numbered' ? `${i + 1}.` : '•'}</span>
            <input data-testid={`input-list-item-${i}`} value={item} onChange={(e) => updateItems(block.items.map((value, j) => j === i ? e.target.value : value))} className={editInputClass + ' flex-1'} placeholder="Élément de liste" />
            <button type="button" aria-label={`Supprimer l’élément ${i + 1}`} onClick={() => updateItems(block.items.filter((_, j) => j !== i))} className="mt-1 rounded p-1 text-muted-foreground hover:text-destructive"><X size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableBlockEditor({ table, onChange }: { table: WBTable; onChange: (table: WBTable) => void }) {
  const columnCount = Math.max(1, table.columns.length, ...table.rows.map((row) => row.length));
  const columns = Array.from({ length: columnCount }, (_, i) => table.columns[i] ?? '');
  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    const rows = table.rows.map((row, i) => {
      if (i !== rowIndex) return row;
      const next = [...row];
      while (next.length < columnCount) next.push('');
      next[columnIndex] = value;
      return next;
    });
    onChange({ ...table, rows });
  };
  const updateColumn = (index: number, value: string) => onChange({ ...table, columns: columns.map((column, i) => i === index ? value : column) });
  const addColumn = () => onChange({ ...table, columns: [...columns, ''] });
  const removeColumn = (index: number) => {
    if (columnCount === 1) return;
    onChange({ ...table, columns: columns.filter((_, i) => i !== index), rows: table.rows.map((row) => row.filter((_, i) => i !== index)) });
  };
  return (
    <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold">Tableau — aperçu structuré</span>
        <div className="flex gap-2">
          <button type="button" data-testid="button-add-table-column" onClick={addColumn} className="wiki-link inline-flex items-center gap-1 text-xs"><Plus size={12} /> Colonne</button>
          <button type="button" data-testid="button-add-table-row" onClick={() => onChange({ ...table, rows: [...table.rows, Array(columnCount).fill('')] })} className="wiki-link inline-flex items-center gap-1 text-xs"><Plus size={12} /> Ligne</button>
        </div>
      </div>
      <label className="mb-2 block text-xs font-bold">Titre du tableau<input data-testid="input-table-title" value={table.title} onChange={(e) => onChange({ ...table, title: e.target.value })} className={editInputClass} /></label>
      <div className="overflow-x-auto rounded border border-[var(--wiki-border)] dark:border-border">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="bg-[#eaecf0] dark:bg-muted">
              {columns.map((column, i) => (
                <th key={i} className="border-b border-r border-[var(--wiki-border)] p-1.5 text-left align-top">
                  <div className="flex items-start gap-1">
                    <input data-testid={`input-table-column-${i}`} value={column} onChange={(e) => updateColumn(i, e.target.value)} placeholder={`Colonne ${i + 1}`} className="h-7 min-w-0 flex-1 rounded border border-[var(--wiki-border)] bg-white px-1.5 font-bold dark:bg-secondary" />
                    <button type="button" aria-label={`Supprimer la colonne ${i + 1}`} onClick={() => removeColumn(i)} disabled={columnCount === 1} className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"><X size={12} /></button>
                  </div>
                </th>
              ))}
              <th className="w-8 border-b border-[var(--wiki-border)]" />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className="even:bg-[#f8f9fa] dark:even:bg-secondary/30">
                {Array.from({ length: columnCount }, (_, j) => <td key={j} className="border-r border-t border-[var(--wiki-border)] p-1"><input data-testid={`input-table-cell-${i}-${j}`} value={row[j] ?? ''} onChange={(e) => updateCell(i, j, e.target.value)} placeholder="Cellule vide" className="h-7 w-full min-w-[100px] rounded border border-[var(--wiki-border)] bg-white px-1.5 dark:bg-secondary" /></td>)}
                <td className="border-t border-[var(--wiki-border)] p-1 text-center"><button type="button" aria-label={`Supprimer la ligne ${i + 1}`} onClick={() => onChange({ ...table, rows: table.rows.filter((_, j) => j !== i) })} className="rounded p-1 text-muted-foreground hover:text-destructive"><X size={12} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.rows.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Aucune ligne. Le tableau conservera ses colonnes et peut rester vide.</p>}
    </div>
  );
}

function GalleryBlockEditor({ images, onChange }: { images: WBImage[]; onChange: (images: WBImage[]) => void }) {
  const emptyImage = (): WBImage => ({ filename: '', caption: '', alt: '', alignment: 'centre', size: '300', missing: true });
  return (
    <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold">Galerie — images et légendes</span>
        <button type="button" data-testid="button-add-gallery-image" onClick={() => onChange([...images, emptyImage()])} className="wiki-link inline-flex items-center gap-1 text-xs"><Plus size={12} /> Ajouter une image</button>
      </div>
      {images.length === 0 && <p className="text-xs text-muted-foreground">Galerie vide. Ajoutez une image pour la compléter.</p>}
      <div className="space-y-2">
        {images.map((image, i) => (
          <ImageEditor key={i} label={`gallery-${i}`} image={image} onChange={(next) => onChange(images.map((item, j) => j === i ? next : item))} onDelete={() => onChange(images.filter((_, j) => j !== i))} />
        ))}
      </div>
    </div>
  );
}

function BlockEditor({ block, onChange, onDelete, onUp, onDown, canUp, canDown, index }: {
  block: WBBlock;
  onChange: (block: WBBlock) => void;
  onDelete: () => void;
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
  index: number;
}) {
  const heading = block.type === 'text' ? 'Paragraphe' : block.type === 'list' ? 'Liste à puces' : block.type === 'numbered' ? 'Liste numérotée' : block.type === 'image' ? 'Image' : block.type === 'gallery' ? 'Galerie' : 'Tableau';
  return (
    <div data-testid={`editor-block-${index}`} className="relative">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{heading}</span>
        <EditorActions label={`le bloc ${index + 1}`} onUp={onUp} onDown={onDown} onDelete={onDelete} canUp={canUp} canDown={canDown} />
      </div>
      {block.type === 'text' && <textarea data-testid={`textarea-block-${index}`} value={block.content} onChange={(e) => onChange({ ...block, content: e.target.value })} className={editTextareaClass} placeholder="Texte du paragraphe" />}
      {(block.type === 'list' || block.type === 'numbered') && <ListBlockEditor block={block} onChange={onChange} />}
      {block.type === 'image' && <ImageEditor label={`block-${index}`} image={block.image} onChange={(image) => onChange({ ...block, image })} onDelete={onDelete} />}
      {block.type === 'gallery' && <GalleryBlockEditor images={block.images} onChange={(images) => onChange({ ...block, images })} />}
      {block.type === 'table' && <TableBlockEditor table={block.table} onChange={(table) => onChange({ ...block, table })} />}
    </div>
  );
}

function InfoboxReferencePreview({ value }: { value: string }) {
  const trimmed = value.trim();
  const flag = /^\[flag:\s*([a-zA-Z0-9-]+)\]$/i.exec(trimmed);
  const imageReference = /^(?:\[(?:logo|image):\s*)?([^|\]]+\.(?:png|jpe?g|svg|webp))\]?$/i.exec(trimmed)?.[1]?.trim();
  const [failed, setFailed] = useState(false);
  const src = imageReference ? resolveImageSrc({ filename: imageReference, caption: '', alt: '', alignment: 'centre', size: '120', missing: false }) : undefined;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (flag) {
    return <div className="sm:col-span-2 flex items-center gap-2 rounded border border-dashed border-[var(--wiki-border)] bg-white px-2 py-1.5 text-[11px] text-muted-foreground dark:bg-background"><span className="font-bold">Aperçu du drapeau</span><FlagImg code={flag[1].toLowerCase()} /></div>;
  }
  if (!imageReference) return null;
  return (
    <div className="sm:col-span-2 flex items-center gap-2 rounded border border-dashed border-[var(--wiki-border)] bg-white px-2 py-1.5 text-[11px] text-muted-foreground dark:bg-background">
      <span className="font-bold">Référence visuelle</span>
      {src && !failed
        ? <img src={src} alt="Aperçu du logo ou drapeau" className="h-8 max-w-16 object-contain" onError={() => setFailed(true)} />
        : <span className="flex items-center gap-1"><ImageIcon size={13} />Fichier introuvable</span>}
      <span className="truncate font-mono">{imageReference}</span>
    </div>
  );
}

function EditPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { pages, persistPages, ready } = usePages();
  const original = pages.find((p) => p.id === id) ?? pages[0];
  const [page, setPage] = useState<WikiPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (ready && original && !page) setPage(structuredClone(original));
  }, [ready, original?.id]);

  const update = (key: keyof WikiPage, value: unknown) => setPage((p) => p ? { ...p, [key]: value } : p);
  const save = async () => {
    if (!page) return;
    setSaving(true);
    setSaveError('');
    const timestamp = new Date().toISOString();
    const next = pages.map((p) => p.id === page.id
      ? { ...page, updatedAt: timestamp, history: [...p.history, { timestamp, label: 'Modification visuelle', sourceText: page.sourceText }] }
      : p
    );
    try {
      await persistPages(next);
      setLocation(`/page/${page.id}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'La sauvegarde n’a pas pu être écrite.');
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !page) return <div className="animate-rise p-6 text-sm text-muted-foreground">Chargement…</div>;
  const updateInfo = (index: number, value: string, key: 'key' | 'value') =>
    update('infobox', page.infobox.map((r, i) => i === index ? { ...r, [key]: value } : r));
  const updateInfoboxSection = (index: number, next: WBInfoboxSection) =>
    update('infoboxSections', (page.infoboxSections ?? []).map((section, i) => i === index ? next : section));
  const updateSection = (index: number, next: WBSection) =>
    update('sections', page.sections.map((section, i) => i === index ? next : section));
  const move = <T,>(items: T[], from: number, to: number) => {
    if (to < 0 || to >= items.length) return items;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };
  const emptyImage = (): WBImage => ({ filename: '', caption: '', alt: '', alignment: 'centre', size: '300', missing: true });
  const addBlock = (sectionIndex: number, type: WBBlock['type']) => {
    const block: WBBlock = type === 'text'
      ? { type, content: '' }
      : type === 'list' || type === 'numbered'
        ? { type, items: [''] }
        : type === 'image'
          ? { type, image: emptyImage() }
          : type === 'gallery'
            ? { type, images: [] }
            : { type, table: { title: '', columns: [''], rows: [] } };
    updateSection(sectionIndex, { ...page.sections[sectionIndex], blocks: [...page.sections[sectionIndex].blocks, block] });
  };

  const currentColor = page.accentColor ?? categoryColor(page.category);

  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-editorial text-[1.8em] font-normal">Modifier : {page.title}</h1>
        <div className="flex gap-2 items-center">
          <Link href={`/page/${page.id}`} data-testid="link-cancel-edit" className="wiki-link text-sm">Annuler</Link>
          <Button data-testid="button-save-page" onClick={() => void save()} disabled={saving}><Check size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </div>
      <div className="border-b border-[var(--wiki-border)] dark:border-border mb-5 pb-2 text-xs text-muted-foreground">
        Chaque sauvegarde ajoute une version à l'historique. Les modifications visuelles ne réécrivent jamais la source TXT.
      </div>
      {saveError && <div role="alert" className="mb-4 rounded border border-destructive/40 bg-red-50 px-3 py-2 text-sm text-destructive dark:bg-red-950/30">{saveError}</div>}

      <div className="mx-auto max-w-3xl space-y-4">
        {/* Identity */}
        <div className={editCardClass}>
          <div className="mb-3 font-bold">Identité</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold">Titre<input data-testid="input-edit-title" value={page.title} onChange={(e) => update('title', e.target.value)} className="mt-1 h-9 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-2 text-sm font-normal" /></label>
            <label className="text-xs font-bold">Sous-titre<input data-testid="input-edit-subtitle" value={page.subtitle} onChange={(e) => update('subtitle', e.target.value)} className="mt-1 h-9 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-2 text-sm font-normal" /></label>
          </div>
          <label className="mt-3 block text-xs font-bold">Introduction<textarea data-testid="textarea-edit-introduction" value={page.introduction} onChange={(e) => update('introduction', e.target.value)} className="mt-1 min-h-24 w-full rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary p-2 text-sm font-normal leading-6" /></label>
        </div>

        {/* Infobox colour */}
        <div className={editCardClass}>
          <div className="mb-3 font-bold">Couleur de l'infobox</div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => update('accentColor', e.target.value)}
              aria-label="Couleur de l'infobox"
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
        <div className={editCardClass}>
          <div className="mb-3 flex items-center justify-between font-bold">
            <div><div>Infobox</div><p className="mt-1 text-xs font-normal text-muted-foreground">Un champ sans valeur est affiché comme une bannière. Utilisez <span className="font-mono">[flag: fr]</span> ou un chemin d’image pour éditer une référence visuelle avec aperçu.</p></div>
            <Button data-testid="button-add-infobox-field" variant="outline" onClick={() => update('infobox', [...page.infobox, { key: 'Nouveau champ', value: '' }])}>
              <Plus size={13} /> Champ
            </Button>
          </div>
          <div className="space-y-2">
            {page.infobox.map((row, i) => (
              <div key={i} className="flex items-start gap-1.5 rounded bg-[#f8f9fa] p-2 dark:bg-secondary">
                <div className="grid flex-1 gap-1.5 sm:grid-cols-[2fr_3fr]">
                  <input data-testid={`input-infobox-key-${i}`} aria-label={`Clé infobox ${i + 1}`} value={row.key} onChange={(e) => updateInfo(i, e.target.value, 'key')} className={editInputClass + ' mt-0'} placeholder="Nom ou bannière" />
                  <input data-testid={`input-infobox-value-${i}`} aria-label={`Valeur ou référence visuelle infobox ${i + 1}`} value={row.value} onChange={(e) => updateInfo(i, e.target.value, 'value')} className={editInputClass + ' mt-0'} placeholder="Valeur, [flag: fr] ou logo.png" />
                  <InfoboxReferencePreview value={row.value} />
                </div>
                <EditorActions label={`le champ ${i + 1}`} onUp={() => update('infobox', move(page.infobox, i, i - 1))} onDown={() => update('infobox', move(page.infobox, i, i + 1))} onDelete={() => update('infobox', page.infobox.filter((_, j) => j !== i))} canUp={i > 0} canDown={i < page.infobox.length - 1} />
              </div>
            ))}
            {page.infobox.length === 0 && <p className="text-xs text-muted-foreground">Aucun champ d’infobox. Ajoutez une bannière ou un champ clé / valeur.</p>}
          </div>
        </div>

        <div className={editCardClass}>
          <div className="mb-1 font-bold">Image de l'infobox</div>
          <p className="mb-3 text-xs leading-5 text-muted-foreground">
            {page.infoboxImage && !page.infoboxImageOverride
              ? 'Image détectée depuis le texte de l’article. Votre choix ci-dessous la remplace visuellement sans modifier la source.'
              : page.infoboxImageOverride
                ? 'Cette image est un choix visuel et ne modifie pas le texte brut de l’article.'
                : 'Ajoutez une image visuelle sans modifier le texte brut de l’article.'}
          </p>
          <ImageEditor
            label="infobox"
            image={page.infoboxImageOverride ?? page.infoboxImage ?? {
              filename: '',
              caption: '',
              alt: page.title,
              alignment: 'centre',
              size: '300',
              missing: true,
            }}
            onChange={(img) => update('infoboxImageOverride', img)}
            onDelete={() => update('infoboxImageOverride', undefined)}
          />
        </div>

        {/* Jersey kits */}
        <div className={editCardClass}>
          <div className="mb-1 flex items-center justify-between gap-2 font-bold">
            <div>Maillots <Badge>{page.infoboxJerseys?.length ?? 0}</Badge></div>
            <Button data-testid="button-add-jersey" variant="outline" onClick={() => update('infoboxJerseys', [...(page.infoboxJerseys ?? []), { name: 'Nouveau maillot', colors: ['#cccccc'] }])}><Plus size={13} /> Ajouter</Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Définissez les couleurs et, si nécessaire, associez une image de maillot. Cette association visuelle ne modifie pas la source TXT.</p>
          <div className="space-y-3">
            {(page.infoboxJerseys ?? []).map((jersey, i) => (
              <div key={i} className="rounded border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] p-3 dark:bg-secondary">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <label className="text-xs font-bold">Nom<input data-testid={`input-jersey-name-${i}`} value={jersey.name} onChange={(e) => update('infoboxJerseys', (page.infoboxJerseys ?? []).map((item, j) => j === i ? { ...item, name: e.target.value } : item))} className={editInputClass} /></label>
                    <label className="text-xs font-bold">Couleurs (hexadécimales séparées par des virgules)<input data-testid={`input-jersey-colors-${i}`} value={jersey.colors.join(', ')} onChange={(e) => update('infoboxJerseys', (page.infoboxJerseys ?? []).map((item, j) => j === i ? { ...item, colors: e.target.value.split(',').map((color) => color.trim()).filter(Boolean) } : item))} className={editInputClass} placeholder="#ffffff, #123456" /></label>
                  </div>
                  <EditorActions label={`le maillot ${i + 1}`} onUp={() => update('infoboxJerseys', move(page.infoboxJerseys ?? [], i, i - 1))} onDown={() => update('infoboxJerseys', move(page.infoboxJerseys ?? [], i, i + 1))} onDelete={() => update('infoboxJerseys', (page.infoboxJerseys ?? []).filter((_, j) => j !== i))} canUp={i > 0} canDown={i < (page.infoboxJerseys?.length ?? 0) - 1} />
                </div>
                {jersey.image
                  ? <div className="mt-2"><ImageEditor label={`jersey-${i}`} image={jersey.image} onChange={(image) => update('infoboxJerseys', (page.infoboxJerseys ?? []).map((item, j) => j === i ? { ...item, image } : item))} onDelete={() => update('infoboxJerseys', (page.infoboxJerseys ?? []).map((item, j) => j === i ? { ...item, image: undefined } : item))} /></div>
                  : <button type="button" data-testid={`button-add-jersey-image-${i}`} onClick={() => update('infoboxJerseys', (page.infoboxJerseys ?? []).map((item, j) => j === i ? { ...item, image: { ...emptyImage(), alt: item.name } } : item))} className="mt-2 wiki-link text-xs">+ Associer une image au maillot</button>}
              </div>
            ))}
          </div>
          {(page.infoboxJerseys ?? []).length === 0 && <p className="text-xs text-muted-foreground">Aucun maillot structuré. Les anciens champs texte restent affichés et éditables dans l’infobox.</p>}
        </div>

        {/* Infobox sub-sections */}
        <div className={editCardClass}>
          <div className="mb-3 flex items-center justify-between gap-2 font-bold">
            <div>Sous-sections de l'infobox <Badge>{page.infoboxSections?.length ?? 0}</Badge></div>
            <Button data-testid="button-add-infobox-section" variant="outline" onClick={() => update('infoboxSections', [...(page.infoboxSections ?? []), { title: 'Nouvelle sous-section', fields: [{ key: 'Nouveau champ', value: '' }] }])}><Plus size={13} /> Ajouter</Button>
          </div>
          <div className="space-y-3">
            {(page.infoboxSections ?? []).map((section, i) => (
              <div key={i} className="rounded border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] p-3 dark:bg-secondary">
                <div className="flex items-start gap-2">
                  <input data-testid={`input-infobox-section-title-${i}`} aria-label={`Titre de la sous-section d’infobox ${i + 1}`} value={section.title} onChange={(e) => updateInfoboxSection(i, { ...section, title: e.target.value })} className={editInputClass + ' mt-0 flex-1 font-bold'} />
                  <EditorActions label={`la sous-section ${i + 1}`} onUp={() => update('infoboxSections', move(page.infoboxSections ?? [], i, i - 1))} onDown={() => update('infoboxSections', move(page.infoboxSections ?? [], i, i + 1))} onDelete={() => update('infoboxSections', (page.infoboxSections ?? []).filter((_, j) => j !== i))} canUp={i > 0} canDown={i < (page.infoboxSections?.length ?? 0) - 1} />
                </div>
                <div className="mt-2 space-y-1.5">
                  {section.fields.map((field, j) => (
                    <div key={j} className="flex gap-1.5">
                      <input data-testid={`input-infobox-section-key-${i}-${j}`} aria-label={`Clé du champ ${j + 1} de la sous-section d’infobox ${i + 1}`} value={field.key} onChange={(e) => updateInfoboxSection(i, { ...section, fields: section.fields.map((item, k) => k === j ? { ...item, key: e.target.value } : item) })} className={editInputClass + ' mt-0 flex-1'} />
                      <input data-testid={`input-infobox-section-value-${i}-${j}`} aria-label={`Valeur du champ ${j + 1} de la sous-section d’infobox ${i + 1}`} value={field.value} onChange={(e) => updateInfoboxSection(i, { ...section, fields: section.fields.map((item, k) => k === j ? { ...item, value: e.target.value } : item) })} className={editInputClass + ' mt-0 flex-[1.5]'} />
                      <button type="button" aria-label={`Supprimer le champ ${j + 1}`} onClick={() => updateInfoboxSection(i, { ...section, fields: section.fields.filter((_, k) => k !== j) })} className="mt-1 rounded p-1 text-muted-foreground hover:text-destructive"><X size={13} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => updateInfoboxSection(i, { ...section, fields: [...section.fields, { key: 'Nouveau champ', value: '' }] })} className="wiki-link mt-1 inline-flex items-center gap-1 text-xs"><Plus size={12} /> Champ</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sections and structured blocks */}
        <div className={editCardClass}>
          <div className="mb-3 flex items-center justify-between gap-2 font-bold">
            <div>Sections et blocs <Badge>{page.sections.length}</Badge></div>
            <Button data-testid="button-add-section" variant="outline" onClick={() => update('sections', [...page.sections, { title: 'Nouvelle section', level: 2, blocks: [{ type: 'text', content: '' }] }])}><Plus size={13} /> Section</Button>
          </div>
          {page.sections.length === 0 && <p className="mb-3 text-xs text-muted-foreground">Aucune section. Ajoutez-en une pour structurer l’article.</p>}
          <div className="space-y-4">
            {page.sections.map((section, i) => (
              <div data-testid={`editor-section-${i}`} key={i} className="rounded border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] p-3 dark:bg-secondary">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_130px]">
                    <label className="text-xs font-bold">Titre<input data-testid={`input-section-title-${i}`} value={section.title} onChange={(e) => updateSection(i, { ...section, title: e.target.value })} className={editInputClass} /></label>
                    <label className="text-xs font-bold">Niveau<select data-testid={`select-section-level-${i}`} value={section.level} onChange={(e) => updateSection(i, { ...section, level: Number(e.target.value) })} className={editInputClass}><option value={2}>Section</option><option value={3}>Sous-section</option><option value={4}>Sous-sous-section</option></select></label>
                  </div>
                  <EditorActions label={`la section ${i + 1}`} onUp={() => update('sections', move(page.sections, i, i - 1))} onDown={() => update('sections', move(page.sections, i, i + 1))} onDelete={() => update('sections', page.sections.filter((_, j) => j !== i))} canUp={i > 0} canDown={i < page.sections.length - 1} />
                </div>
                <div className="mt-3 space-y-4">
                  {section.blocks.map((block, j) => (
                    <BlockEditor
                      key={j}
                      block={block}
                      index={j}
                      canUp={j > 0}
                      canDown={j < section.blocks.length - 1}
                      onChange={(next) => updateSection(i, { ...section, blocks: section.blocks.map((item, k) => k === j ? next : item) })}
                      onUp={() => updateSection(i, { ...section, blocks: move(section.blocks, j, j - 1) })}
                      onDown={() => updateSection(i, { ...section, blocks: move(section.blocks, j, j + 1) })}
                      onDelete={() => updateSection(i, { ...section, blocks: section.blocks.filter((_, k) => k !== j) })}
                    />
                  ))}
                  <div className="flex flex-wrap items-center gap-2 border-t border-[var(--wiki-border)] pt-3 dark:border-border">
                    <span className="text-xs font-bold text-muted-foreground">Ajouter un bloc :</span>
                    {(['text', 'list', 'numbered', 'image', 'table', 'gallery'] as const).map((type) => <button type="button" key={type} data-testid={`button-add-block-${type}`} onClick={() => addBlock(i, type)} className="wiki-link rounded border border-primary/25 px-2 py-1 text-xs hover:bg-primary/5">{type === 'text' ? 'Paragraphe' : type === 'list' ? 'Liste' : type === 'numbered' ? 'Liste numérotée' : type === 'image' ? 'Image' : type === 'table' ? 'Tableau' : 'Galerie'}</button>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ComparePage ────────────────────────────────────────────────────────── */

function ComparePage() {
  const { id } = useParams<{ id: string }>();
  const { pages, setPages, ready } = usePages();
  const page = pages.find((p) => p.id === id) ?? pages[0];
  const [source, setSource] = useState('');
  const [candidate, setCandidate] = useState<WikiPage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');

  const analyze = () => page && setCandidate(parseWikiText(source || demoSource, page.category, page.type));
  const changed = candidate && page
    ? [
        { label: 'Titre', old: page.title, next: candidate.title },
        { label: 'Introduction', old: page.introduction, next: candidate.introduction },
        { label: 'Nombre de sections', old: String(page.sections.length), next: String(candidate.sections.length) },
      ].filter((d) => d.old !== d.next)
    : [];
  const apply = () => {
    if (!candidate || !page) return;
    setPages(pages.map((p) => p.id === page.id
      ? { ...candidate, id: page.id, history: [...page.history, { timestamp: new Date().toISOString(), label: 'Mise à jour depuis un TXT', sourceText: candidate.sourceText }] }
      : p
    ));
    setStatus('Mise à jour appliquée');
  };

  if (!ready) return <div className="animate-rise p-6 text-sm text-muted-foreground">Chargement…</div>;

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
  const { pages, ready } = usePages();
  const page = pages.find((p) => p.id === id) ?? pages[0];
  if (!ready || !page) return <div className="animate-rise p-6 text-sm text-muted-foreground">Chargement…</div>;
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
  const { pages, setPages } = usePages();
  const trashed = pages.filter((p) => p.isTrashed);
  const restore = (id: string) => { const n = pages.map((p) => p.id === id ? { ...p, isTrashed: false } : p); setPages(n); };
  const destroy = (id: string) => { const n = pages.filter((p) => p.id !== id); setPages(n); };
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

/* ─── X / Twitter Clone ─────────────────────────────────────────────────── */

type XAccount = {
  handle: string;
  name: string;
  avatarUrl?: string;
  initials: string;
  avatarColor: string;
  badge: 'gold' | 'blue' | null;
  category: TwitterAccountCategory;
  followers: number;
  country?: string;
  isSystem?: boolean;
  profileId?: string;
  bio?: string;
  bannerUrl?: string;
  avatarMedia?: string;
  bannerMedia?: string;
  following?: number;
  relatedHandles?: string[];
  wikiPageId?: string;
  wikiPageTitle?: string;
};
type XFeedTopic = 'MERCATO' | 'MATCHES' | 'TACTICS' | 'CLUB_LIFE' | 'MISC';
type XReply   = { id: string; acct: XAccount; text: string; likes: number; retweets?: number; views?: number; ts: number; editedAt?: number; engagementVersion?: 1; source?: 'ai' | 'manual' };
type XTweet   = {
  id: string;
  acct: XAccount;
  text: string;
  imageUrl?: string;
  ts: number;
  likes: number;
  retweets: number;
  views: number;
  liked: boolean;
  retweeted: boolean;
  replies: XReply[];
  editedAt?: number;
  topic?: XFeedTopic;
  aiContext?: string;
  aiReplyCount?: number;
  commentCount?: number;
  engagementVersion?: 1;
  likedByHandles?: string[];
  retweetedByHandles?: string[];
};

const xColor  = (s: string) => { let h = 0; for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0; return `hsl(${((h >>> 0) % 360)},60%,42%)`; };
const xCanonicalMedia = (value: string) => {
  const media = value.trim();
  return (/^\/api\/images\/(?:shared|instagram|wikibase|twitter|airways)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,110}\.(?:svg|png|jpe?g|webp)$/i.test(media)
    || /^upload:[a-zA-Z0-9-]{1,80}$/.test(media)
    || /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}\.(?:svg|png|jpe?g|webp)$/i.test(media)) ? media : undefined;
};
const xHandle = (t: string) => '@' + t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
const xInits  = (n: string) => { const p = n.trim().split(/\s+/); return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : n.slice(0, 2)).toUpperCase(); };
const xBadge  = (cat: string): 'gold' | 'blue' | null => ['Sports & Football','Économie','Transports','Géographie','Monuments & Lieux'].includes(cat) ? 'gold' : ['Personnes & Organisations','Politique'].includes(cat) ? 'blue' : 'gold';
const fmtN    = (n: number) => formatTwitterCount(n);
const xAgo    = (ts: number) => { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return `${s}s`; const m = Math.floor(s / 60); if (m < 60) return `${m}min`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
const xHash = (value: string) => [...value].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 2166136261);
const xSeeded = (seed: string, min: number, max: number) => min + (xHash(seed) % (max - min + 1));

function followersForAccount(account: Pick<XAccount, 'handle' | 'category' | 'isSystem'> & { followers?: number }) {
  if (typeof account.followers === 'number' && account.followers > 0) return Math.round(account.followers);
  if (account.isSystem) return xSeeded(`${account.handle}:followers`, 900, 18_000);
  const ranges: Record<TwitterAccountCategory, [number, number]> = {
    WIKI_OFFICIAL: [35_000, 640_000],
    MERCATO_GLOBAL: [650_000, 5_200_000],
    FRANCE_INSIDERS_MEDIAS: [90_000, 2_100_000],
    UK_INSIDERS_MEDIAS: [120_000, 2_800_000],
    SPAIN_INSIDERS_MEDIAS: [80_000, 2_300_000],
    ITALY_INSIDERS_MEDIAS: [70_000, 1_900_000],
    GERMANY_INSIDERS_MEDIAS: [75_000, 1_800_000],
    DATA_TACTICS_INVESTIGATION: [40_000, 950_000],
  };
  const [min, max] = ranges[account.category];
  return xSeeded(`${account.handle}:followers`, min, max);
}

function engagementFor(account: Pick<XAccount, 'handle' | 'category' | 'isSystem'> & { followers?: number }, seed: string) {
  const followers = followersForAccount(account);
  const variation = xSeeded(`${seed}:variation`, 0, 10_000) / 10_000;
  const views = Math.max(18, Math.round(followers * (0.16 + variation * 0.34)));
  const likes = Math.max(1, Math.round(followers * (0.006 + variation * 0.02)));
  const retweets = Math.max(0, Math.round(likes * (0.025 + variation * 0.12)));
  return { likes, retweets, views };
}

function simulatedCommentCount(account: Pick<XAccount, 'handle' | 'category' | 'isSystem'> & { followers?: number }, seed: string) {
  const followers = followersForAccount(account);
  const variation = xSeeded(`${seed}:comments`, 0, 10_000) / 10_000;
  return Math.max(2, Math.round(followers * (0.0007 + variation * 0.003)));
}

const XACCOUNT_RELATIONS: Record<string, string[]> = {
  '@caledorafc': ['@CaledoraSport'],
  '@oriabank': ['@MediaCaledora'],
  '@caledoraairways': ['@MediaCaledora'],
};

function wikiToXAcct(p: WikiPage, profile?: InstagramProfile): XAccount {
  const twitter = profile?.twitter;
  const avatarMedia = twitter?.avatar ?? profile?.avatar;
  let avatarUrl: string | undefined;
  if (avatarMedia) avatarUrl = instagramMediaUrl(avatarMedia);
  else if (p.infoboxImage) { const f = (p.infoboxImage.src || p.infoboxImage.filename).trim(); if (f) avatarUrl = /^(https?:\/\/|data:)/.test(f) ? f : import.meta.env.BASE_URL + f.replace(/^\/+/, ''); }
  const handle = twitter?.handle || xHandle(p.title);
  return {
    handle,
    name: profile?.displayName || p.title,
    avatarUrl,
    initials: xInits(profile?.displayName || p.title),
    avatarColor: xColor(profile?.displayName || p.title),
    badge: profile?.verified ? 'blue' : xBadge(p.category),
    category: 'WIKI_OFFICIAL',
    followers: twitter?.followers ?? profile?.followers ?? followersForAccount({ handle, category: 'WIKI_OFFICIAL' }),
    following: twitter?.following ?? profile?.following,
    bio: twitter?.bio ?? profile?.bio,
    bannerUrl: twitter?.banner ? instagramMediaUrl(twitter.banner) : undefined,
    avatarMedia,
    bannerMedia: twitter?.banner,
    profileId: profile?.id,
    wikiPageId: p.id,
    wikiPageTitle: p.title,
    relatedHandles: XACCOUNT_RELATIONS[handle.toLowerCase()],
  };
}

const XMEDIA: XAccount[] = [
  { handle: '@CaledoraSport', name: 'Caledora Sport',   initials: 'CS', avatarColor: '#1d9bf0', badge: 'blue', category: 'WIKI_OFFICIAL', followers: 510_000, isSystem: true, relatedHandles: ['@CaledoraFC'] },
  { handle: '@MediaCaledora', name: 'Médias Caledora',  initials: 'MC', avatarColor: '#7856ff', badge: 'blue', category: 'WIKI_OFFICIAL', followers: 280_000, isSystem: true, relatedHandles: ['@CaledoraAirways', '@OriaBank'] },
  { handle: '@InsiderCaled',  name: 'Caledora Insider', initials: 'CI', avatarColor: '#00ba7c', badge: null,   category: 'WIKI_OFFICIAL', followers: 46_000, isSystem: true },
  { handle: '@CFCFan07',      name: 'Fan CFC 🏟️',       initials: 'FC', avatarColor: '#ff7a00', badge: null,   category: 'WIKI_OFFICIAL', followers: 8_700, isSystem: true },
];

function categoryFromSocialReference(category: string): TwitterAccountCategory {
  const value = category.toLowerCase();
  if (/(tactique|data|investigation|économie|geopolitique|finance)/.test(value)) return 'DATA_TACTICS_INVESTIGATION';
  if (/(mercato|transfert|global)/.test(value)) return 'MERCATO_GLOBAL';
  if (/angleterre/.test(value)) return 'UK_INSIDERS_MEDIAS';
  if (/espagne/.test(value)) return 'SPAIN_INSIDERS_MEDIAS';
  if (/italie/.test(value)) return 'ITALY_INSIDERS_MEDIAS';
  if (/allemagne/.test(value)) return 'GERMANY_INSIDERS_MEDIAS';
  if (/france|caledora/.test(value)) return 'FRANCE_INSIDERS_MEDIAS';
  return 'WIKI_OFFICIAL';
}

const XREGISTRY: XAccount[] = TWITTER_ACCOUNTS.map(acct => ({
  ...acct,
  initials: xInits(acct.name),
  avatarColor: xColor(acct.name),
  followers: followersForAccount(acct),
  isSystem: true,
}));
const XSOCIAL_REFERENCE: XAccount[] = socialAccountProfiles.map(profile => {
  const category = categoryFromSocialReference(profile.category);
  const handle = `@${profile.username}`;
  return {
    handle,
    name: profile.displayName,
    initials: xInits(profile.displayName),
    avatarColor: xColor(profile.displayName),
    badge: profile.verified ? 'blue' : null,
    category,
    followers: followersForAccount({ handle, category, followers: profile.followers, isSystem: true }),
    isSystem: true,
  };
});

const XTRENDS = [['#CFCvARS','42,1K tweets'],['#Caledora','18,7K tweets'],['#CaledoraSport','9,4K tweets'],['#OriaBankOpen','6,2K tweets'],['#CALNED','4,8K tweets']] as const;

const xReplyTpl = (name: string) => [
  `🔥 ${name} continue de marquer les esprits ! La communauté de Caledora est avec vous 💙 #Caledora`,
  `On en parle ce soir sur @CaledoraSport ! Merci ${name} pour cette mise à jour 📺`,
  `Notre analyse arrive bientôt sur @MediaCaledora — restez connectés 📰`,
  `Quelle nouvelle ! ${name} fait avancer les choses dans la République 💪 #CaledoraCity`,
  `Bravo ! Les fans attendaient ça depuis longtemps 🎉 #Caledora`,
  `⚡ Le dynamisme de Caledora ne s'arrête jamais ! #CaledoraSport`,
];

const XTOPICS: ReadonlyArray<{ id: 'ALL' | XFeedTopic; label: string }> = [
  { id: 'ALL', label: 'Tous' },
  { id: 'MERCATO', label: 'Mercato' },
  { id: 'MATCHES', label: 'Matchs' },
  { id: 'TACTICS', label: 'Tactique' },
  { id: 'CLUB_LIFE', label: 'Vie des clubs' },
  { id: 'MISC', label: 'Divers' },
];

function classifyTweetTopic(text: string): XFeedTopic {
  const value = text.toLowerCase();
  if (/(transfert|mercato|recrue|signature|contrat|here we go|prêt|loan|deadline)/.test(value)) return 'MERCATO';
  if (/(match|matchday|score|but|victoire|défaite|nul|classement|stade|coup d'envoi|derby)/.test(value)) return 'MATCHES';
  if (/(tactique|analyse|data|stat|xg|pressing|système|formation|scout)/.test(value)) return 'TACTICS';
  if (/(supporter|tribune|club|entra[iî]nement|académie|maillot|vestiaire|communauté|anniversaire)/.test(value)) return 'CLUB_LIFE';
  return 'MISC';
}

function contextCategories(topic: XFeedTopic): TwitterAccountCategory[] {
  if (topic === 'MERCATO') return ['MERCATO_GLOBAL', 'FRANCE_INSIDERS_MEDIAS', 'UK_INSIDERS_MEDIAS', 'SPAIN_INSIDERS_MEDIAS', 'ITALY_INSIDERS_MEDIAS', 'GERMANY_INSIDERS_MEDIAS'];
  if (topic === 'TACTICS') return ['DATA_TACTICS_INVESTIGATION'];
  return ['WIKI_OFFICIAL'];
}

function uniqueXAccounts(accounts: XAccount[]) {
  return [...new Map(accounts.map(acct => [acct.handle.toLowerCase(), acct])).values()];
}

/** Extract all @handles from tweet text (unique, case-preserved) */
const extractMentions = (text: string): string[] => [...new Set((text.match(/@[a-zA-Z0-9_]+/g) || []))];

/** Generate a contextualised reply from a mentioned account */
function genMentionReply(mentionedAcct: XAccount, tweetText: string, author: XAccount): string {
  const t = tweetText.toLowerCase();
  const n = author.name;
  if (t.includes('?'))                                         return `Bonjour ${n} ! Merci pour votre question 🙏 Notre équipe reviendra vers vous très rapidement avec une réponse complète.`;
  if (/félicit|bravo|congrat|bien jou|magnif/.test(t))        return `Merci beaucoup ${n} ! 🙌 Votre soutien compte énormément pour nous. On continue ensemble 💙`;
  if (/match|⚽|victoire|stade|tribune|foot/.test(t))         return `On vous attend dans les tribunes ${n} ! 💙🏟️ Ce sera un grand match ! #CFCvARS`;
  if (/bienvenu|annonce|ouverture|lancement|nouveau/.test(t)) return `Merci pour le partage ${n} ! 🚀 Restez connectés pour toutes nos actualités #Caledora`;
  if (/merci|remerci/.test(t))                                return `Avec plaisir ${n} ! 😊 C'est toujours un bonheur d'échanger avec notre communauté.`;
  const fb = [
    `Merci pour la mention ${n} ! Nous sommes ravis de votre intérêt 🙏`,
    `Bonjour ${n} ! Un grand merci pour votre message 📩 Notre équipe est à votre disposition.`,
    `Merci ${n} ! Ensemble nous faisons avancer Caledora 💪 #Caledora`,
  ];
  return fb[Math.floor(Math.random() * fb.length)];
}

/** Render tweet text with @mentions highlighted in blue */
function XTweetText({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^@[a-zA-Z0-9_]+$/.test(part)
          ? <span key={i} style={{ color: '#1d9bf0' }} className="hover:underline cursor-pointer">{part}</span>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

const XSTORAGE = 'caledora-x-tweets';
const XINIT: XTweet[] = [
  { id:'xi1', ts:Date.now()-1000*60*35,  likes:847, retweets:234, views:12400, liked:false, retweeted:false, replies:[], acct:{ handle:'@CaledoraFC',      name:'Caledora FC',       initials:'CF', avatarColor:xColor('Caledora FC'),       avatarUrl:`${import.meta.env.BASE_URL}images/logo1.png`,    badge:'gold', category:'WIKI_OFFICIAL', followers: 1_180_000, relatedHandles: ['@CaledoraSport'] }, text:'⚽ Matchday ! Caledora FC reçoit Arsenal ce samedi à 20h45 au Caledora Mare Stadium. Soyez nombreux dans les tribunes ! 💙🏟️ #CFCvARS #Caledora' },
  { id:'xi2', ts:Date.now()-1000*60*90,  likes:312, retweets:89,  views:5800,  liked:false, retweeted:false, replies:[], acct:{ handle:'@OriaBank',         name:'Oria Bank',         initials:'OB', avatarColor:xColor('Oria Bank'),         avatarUrl:`${import.meta.env.BASE_URL}images/oriabank.png`, badge:'gold', category:'WIKI_OFFICIAL', followers: 420_000, relatedHandles: ['@MediaCaledora'] }, text:'🏦 Oria Bank est fière d\'annoncer l\'ouverture de sa 12e agence à Caledora City ! Rendez-vous lundi pour l\'inauguration. #OriaBankOpen' },
  { id:'xi3', ts:Date.now()-1000*60*180, likes:521, retweets:173, views:9100,  liked:false, retweeted:false, replies:[], acct:{ handle:'@CaledoraAirways', name:'Caledora Airways',  initials:'CA', avatarColor:xColor('Caledora Airways'), avatarUrl:`${import.meta.env.BASE_URL}images/airways2.jpg`,badge:'gold', category:'WIKI_OFFICIAL', followers: 510_000, relatedHandles: ['@MediaCaledora'] }, text:'✈️ Nouvelle liaison directe Caledora City → Paris CDG dès le 1er septembre ! Réservez vos billets en avant-première. Bon vol à tous 🌍' },
];

function normalizeXAccount(account: XAccount): XAccount {
  return { ...account, followers: followersForAccount(account) };
}

function normalizeTweet(tweet: XTweet): XTweet {
  const acct = normalizeXAccount(tweet.acct);
  const baseline = engagementFor(acct, tweet.id);
  return {
    ...tweet,
    acct,
    topic: tweet.topic ?? classifyTweetTopic(tweet.text),
    aiContext: typeof tweet.aiContext === 'string' && tweet.aiContext.trim() ? tweet.aiContext.trim() : undefined,
    aiReplyCount: typeof tweet.aiReplyCount === 'number' ? Math.max(0, Math.min(8, Math.round(tweet.aiReplyCount))) : 2,
    likes: tweet.engagementVersion === 1 ? tweet.likes : baseline.likes,
    retweets: tweet.engagementVersion === 1 ? tweet.retweets : baseline.retweets,
    views: tweet.engagementVersion === 1 ? tweet.views : baseline.views,
    engagementVersion: 1,
    replies: (tweet.replies ?? []).map(reply => {
      const replyAcct = normalizeXAccount(reply.acct);
      const replyBaseline = engagementFor(replyAcct, reply.id);
      return {
        ...reply,
        acct: replyAcct,
        likes: reply.engagementVersion === 1 ? reply.likes : replyBaseline.likes,
        retweets: reply.engagementVersion === 1 ? reply.retweets : replyBaseline.retweets,
        views: reply.engagementVersion === 1 ? reply.views : replyBaseline.views,
        engagementVersion: 1,
        source: reply.source === 'manual' ? 'manual' : 'ai',
      };
    }),
    commentCount: Math.max((tweet.replies ?? []).length, typeof tweet.commentCount === 'number' ? Math.round(tweet.commentCount) : simulatedCommentCount(acct, tweet.id)),
    likedByHandles: Array.isArray(tweet.likedByHandles) ? [...new Set(tweet.likedByHandles.filter(handle => typeof handle === 'string').slice(0, 100))] : [],
    retweetedByHandles: Array.isArray(tweet.retweetedByHandles) ? [...new Set(tweet.retweetedByHandles.filter(handle => typeof handle === 'string').slice(0, 100))] : [],
  };
}

function XAvtr({ acct, size = 40 }: { acct: XAccount; size?: number }) {
  const [err, setErr] = useState(false);
  if (acct.avatarUrl && !err) return <img src={acct.avatarUrl} alt={acct.name} onError={() => setErr(true)} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  return <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ width: size, height: size, background: acct.avatarColor, fontSize: Math.round(size * 0.36) }}>{acct.initials}</div>;
}

function XBadgeIcon({ type }: { type: 'gold' | 'blue' | null }) {
  if (!type) return null;
  return <span title={type === 'gold' ? 'Organisation certifiée' : 'Personnalité certifiée'} style={{ color: type === 'gold' ? '#FFD700' : '#1d9bf0', fontSize: 12, lineHeight: 1 }}>✓</span>;
}

function XTweetMenu({ open, onToggle, onEdit, onDelete, label }: {
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  label: string;
}) {
  return (
    <div className="relative ml-auto shrink-0">
      <button
        onClick={onToggle}
        aria-label={`Actions pour ${label}`}
        aria-expanded={open}
        className="rounded-full p-1.5 text-[#71767b] transition-colors hover:bg-[#1d9bf0]/10 hover:text-[#1d9bf0]"
      >
        <MoreHorizontal size={17} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 min-w-[176px] overflow-hidden rounded-xl border border-[#2f3336] bg-[#16181c] py-1 shadow-2xl">
          <button onClick={onEdit} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-white transition-colors hover:bg-white/10">
            <Pencil size={14} className="text-[#1d9bf0]" /> Modifier le tweet
          </button>
          <button onClick={onDelete} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-[#f4212e] transition-colors hover:bg-[#f4212e]/10">
            <Trash2 size={14} /> Supprimer le tweet
          </button>
        </div>
      )}
    </div>
  );
}

function XAccountSearchField({ accounts, value, onChange, placeholder, ariaLabel, excludeHandle }: {
  accounts: XAccount[];
  value: string;
  onChange: (handle: string) => void;
  placeholder: string;
  ariaLabel: string;
  excludeHandle?: string;
}) {
  const selected = accounts.find(account => account.handle === value);
  const selectedLabel = selected ? `${selected.name} ${selected.handle}` : '';
  const [query, setQuery] = useState(selectedLabel);
  const matches = !query.trim() || query === selectedLabel ? [] : accounts
    .filter(account => account.handle !== excludeHandle)
    .filter(account => `${account.name} ${account.handle}`.toLocaleLowerCase('fr-FR').includes(query.toLocaleLowerCase('fr-FR')))
    .slice(0, 6);

  useEffect(() => {
    const current = accounts.find(account => account.handle === value);
    setQuery(current ? `${current.name} ${current.handle}` : '');
  }, [accounts, value]);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={event => { setQuery(event.target.value); if (value) onChange(''); }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={matches.length > 0}
        className="w-full rounded-xl border border-[#2f3336] bg-[#16181c] px-3 py-2 text-[13px] text-white outline-none placeholder:text-[#71767b] focus:border-[#1d9bf0]"
      />
      {matches.length > 0 && (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-[#2f3336] bg-[#16181c] shadow-2xl">
          {matches.map(account => (
            <button
              type="button"
              key={account.handle}
              onMouseDown={event => { event.preventDefault(); onChange(account.handle); setQuery(`${account.name} ${account.handle}`); }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.06]"
            >
              <XAvtr acct={account} size={30} />
              <span className="min-w-0"><b className="block truncate text-[12px] text-white">{account.name}</b><small className="block truncate text-[11px] text-[#71767b]">{account.handle}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Free-form author entry: typing never selects a profile; only a suggestion click does. */
function XAuthorField({ accounts, value, onChange, placeholder, ariaLabel }: {
  accounts: XAccount[];
  value: string;
  onChange: (handle: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const selected = accounts.find(account => account.handle.toLowerCase() === value.toLowerCase());
  const selectedLabel = selected ? `${selected.name} ${selected.handle}` : '';
  const [query, setQuery] = useState(selectedLabel);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const matches = query.trim() && query !== selectedLabel
    ? accounts.filter(account => `${account.name} ${account.handle}`.toLocaleLowerCase('fr-FR').includes(query.toLocaleLowerCase('fr-FR'))).slice(0, 6)
    : [];
  const selectAccount = (account: XAccount) => {
    onChange(account.handle);
    setQuery(`${account.name} ${account.handle}`);
    setFocused(false);
    setActiveIndex(-1);
  };

  useEffect(() => {
    if (selected) setQuery(`${selected.name} ${selected.handle}`);
    else if (!value) setQuery(current => current);
  }, [value, selected?.handle]);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={event => { setQuery(event.target.value); setFocused(true); onChange(''); setActiveIndex(-1); }}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setActiveIndex(-1); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && matches.length) { event.preventDefault(); setActiveIndex(current => Math.min(current + 1, matches.length - 1)); }
          else if (event.key === 'ArrowUp' && matches.length) { event.preventDefault(); setActiveIndex(current => Math.max(current - 1, 0)); }
          else if (event.key === 'Enter' && activeIndex >= 0 && matches[activeIndex]) { event.preventDefault(); selectAccount(matches[activeIndex]); }
          else if (event.key === 'Escape') { setFocused(false); setActiveIndex(-1); }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={matches.length > 0}
        aria-controls="x-author-options"
        aria-activedescendant={activeIndex >= 0 ? `x-author-option-${activeIndex}` : undefined}
        className="w-full rounded-xl border border-[#2f3336] bg-[#16181c] px-3 py-2 text-[13px] text-white outline-none placeholder:text-[#71767b] focus:border-[#1d9bf0]"
      />
      {matches.length > 0 && (
        <div id="x-author-options" role="listbox" className="absolute inset-x-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-[#2f3336] bg-[#16181c] shadow-2xl">
          {matches.map((account, index) => (
            <button
              type="button"
              key={account.handle}
              id={`x-author-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={event => { event.preventDefault(); selectAccount(account); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.06] ${index === activeIndex ? 'bg-white/[0.08]' : ''}`}
            >
              <XAvtr acct={account} size={30} />
              <span className="min-w-0"><b className="block truncate text-[12px] text-white">{account.name}</b><small className="block truncate text-[11px] text-[#71767b]">{account.handle}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type XProfileEditDraft = {
  name: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  followers: number;
  following: number;
  relations: Array<{ profileId: string; type: InstagramRelationType }>;
};

function xSameAccount(left: XAccount, right: XAccount) {
  return left.profileId && right.profileId
    ? left.profileId === right.profileId
    : left.handle.toLowerCase() === right.handle.toLowerCase();
}

function XProfileMediaPicker({ label, value, onChange, shape = 'square' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  shape?: 'square' | 'banner';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const accept = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(?:png|jpeg|webp|svg\+xml)$/i.test(file.type)) {
      setError('Choisissez une image PNG, JPEG, WebP ou SVG.');
      return;
    }
    setUploading(true); setError('');
    try {
      const uploaded = await uploadMedia(file, 'twitter');
      onChange(uploaded.path);
    } catch {
      setError('L’image n’a pas pu être importée.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  const preview = xCanonicalMedia(value);
  return (
    <div>
      <p className="mb-1 text-[12px] text-[#aab1b8]">{label}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); void accept(event.dataTransfer.files?.[0]); }}
        className={`relative flex w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#536471] bg-[#16181c] px-3 py-3 text-center text-[11px] text-[#aab1b8] hover:border-[#1d9bf0] ${shape === 'banner' ? 'min-h-24' : 'min-h-28'}`}
      >
        {preview && <img src={instagramMediaUrl(preview)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />}
        <span className="relative rounded bg-black/65 px-2 py-1">{uploading ? 'Import en cours…' : 'Déposer une image ou cliquer pour choisir'}</span>
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={event => void accept(event.target.files?.[0])} />
      <input value={value} onChange={event => onChange(event.target.value)} placeholder="ou saisir un chemin de média existant" className="mt-1 w-full rounded-lg border border-[#2f3336] bg-[#16181c] px-2.5 py-1.5 text-[11px] text-white outline-none placeholder:text-[#71767b]" />
      {error && <p className="mt-1 text-[11px] text-[#f91880]">{error}</p>}
    </div>
  );
}

function XProfileModal({ account, publicAccounts, takenHandles, relationItems, tweetCount, replyCount, onClose, onSave }: {
  account: XAccount | null;
  publicAccounts: XAccount[];
  takenHandles: string[];
  relationItems: Array<{ account: XAccount; type: InstagramRelationType }>;
  tweetCount: number;
  replyCount: number;
  onClose: () => void;
  onSave: (draft: XProfileEditDraft) => void;
}) {
  const [editing, setEditing] = useState(true);
  const [relationHandle, setRelationHandle] = useState('');
  const [relationType, setRelationType] = useState<InstagramRelationType>('coéquipier');
  const [saveError, setSaveError] = useState('');
  const [draft, setDraft] = useState<XProfileEditDraft>(() => ({
    name: account?.name ?? '', handle: account?.handle ?? '', bio: account?.bio ?? '',
    avatarUrl: account?.avatarMedia ?? '', bannerUrl: account?.bannerMedia ?? '',
    followers: account?.followers ?? 0, following: account?.following ?? 0,
    relations: relationItems.map(item => ({ profileId: item.account.profileId ?? '', type: item.type })).filter(item => item.profileId),
  }));

  useEffect(() => {
    setEditing(true); setRelationHandle(''); setSaveError('');
    setDraft({
      name: account?.name ?? '', handle: account?.handle ?? '', bio: account?.bio ?? '',
      avatarUrl: account?.avatarMedia ?? '', bannerUrl: account?.bannerMedia ?? '',
      followers: account?.followers ?? 0, following: account?.following ?? 0,
      relations: relationItems.map(item => ({ profileId: item.account.profileId ?? '', type: item.type })).filter(item => item.profileId),
    });
  }, [account, relationItems]);

  if (!account) return null;
  const canEdit = Boolean(account.profileId && !account.isSystem);
  const update = <K extends keyof XProfileEditDraft>(key: K, value: XProfileEditDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const relatedProfileIds = new Set(draft.relations.map(relation => relation.profileId));
  const selectedRelation = publicAccounts.find(candidate => candidate.handle === relationHandle);
  const addRelation = () => {
    if (!selectedRelation?.profileId) return;
    update('relations', [...draft.relations.filter(item => item.profileId !== selectedRelation.profileId), { profileId: selectedRelation.profileId, type: relationType }]);
    setRelationHandle('');
  };
  const submit = () => {
    const nextHandle = `@${draft.handle.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '')}`;
    if (nextHandle === '@') {
      setSaveError('Le pseudo X doit contenir au moins un caractère valide.');
      return;
    }
    if (takenHandles.some(handle => handle.toLowerCase() === nextHandle.toLowerCase() && handle.toLowerCase() !== account.handle.toLowerCase())) {
      setSaveError('Ce pseudo X est déjà réservé par un autre compte.');
      return;
    }
    setSaveError('');
    onSave({ ...draft, handle: nextHandle });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/75 px-3 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <section className="w-full max-w-[620px] overflow-hidden rounded-2xl border border-[#2f3336] bg-black shadow-2xl" onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Profil de ${account.name}`}>
        <div className="relative h-40 bg-gradient-to-br from-[#123a5a] via-[#1d9bf0] to-[#7856ff]">
          {xCanonicalMedia(draft.bannerUrl) && <img src={instagramMediaUrl(xCanonicalMedia(draft.bannerUrl)!)} alt="" className="h-full w-full object-cover" />}
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-black/65 p-2 text-white hover:bg-black" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="px-5 pb-6">
          <div className="-mt-11 flex items-end justify-between gap-3">
            <div className="rounded-full border-4 border-black"><XAvtr acct={{ ...account, avatarUrl: xCanonicalMedia(draft.avatarUrl) ? instagramMediaUrl(xCanonicalMedia(draft.avatarUrl)!) : account.avatarUrl, name: draft.name || account.name, initials: xInits(draft.name || account.name) }} size={88} /></div>
            {canEdit && <button onClick={() => setEditing(value => !value)} className="mb-2 rounded-full border border-[#536471] px-4 py-2 text-[13px] font-bold text-white hover:bg-white/10"><Pencil size={14} className="mr-1.5 inline" />{editing ? 'Voir le profil' : 'Éditer le profil'}</button>}
          </div>
          {!editing ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-1.5"><h2 className="text-[21px] font-extrabold text-white">{account.name}</h2><XBadgeIcon type={account.badge} /></div>
              <p className="text-[14px] text-[#71767b]">{account.handle}</p>
              <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-white">{account.bio || 'Ce compte n’a pas encore de biographie.'}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-[#71767b]"><span><b className="text-white">{fmtN(account.following ?? 0)}</b> Abonnements</span><span><b className="text-white">{fmtN(account.followers)}</b> Abonnés</span><span><b className="text-white">{tweetCount}</b> Tweets</span><span><b className="text-white">{replyCount}</b> Réponses</span></div>
              {relationItems.length > 0 && <div className="mt-5 border-t border-[#2f3336] pt-4"><p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#71767b]">Relations</p><div className="flex flex-wrap gap-2">{relationItems.map(item => <span key={item.account.handle} className="rounded-full bg-[#1d9bf0]/10 px-3 py-1.5 text-[12px] text-[#8ecdf5]">{item.account.name} · {item.type}</span>)}</div></div>}
            </>
          ) : (
            <form className="mt-5 grid gap-3" onSubmit={event => { event.preventDefault(); submit(); }}>
              <label className="text-[12px] text-[#aab1b8]">Nom affiché<input value={draft.name} onChange={event => update('name', event.target.value)} className="mt-1 w-full rounded-lg border border-[#2f3336] bg-[#16181c] px-3 py-2 text-sm text-white outline-none" /></label>
              <label className="text-[12px] text-[#aab1b8]">Pseudo X<input value={draft.handle} onChange={event => update('handle', event.target.value.replace(/\s/g, ''))} className="mt-1 w-full rounded-lg border border-[#2f3336] bg-[#16181c] px-3 py-2 text-sm text-white outline-none" /></label>
              <label className="text-[12px] text-[#aab1b8]">Biographie<textarea value={draft.bio} onChange={event => update('bio', event.target.value)} rows={3} className="mt-1 w-full resize-none rounded-lg border border-[#2f3336] bg-[#16181c] px-3 py-2 text-sm text-white outline-none" /></label>
              <div className="grid gap-3 sm:grid-cols-2"><XProfileMediaPicker label="Photo de profil" value={draft.avatarUrl} onChange={value => update('avatarUrl', value)} /><XProfileMediaPicker label="Bannière" shape="banner" value={draft.bannerUrl} onChange={value => update('bannerUrl', value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><label className="text-[12px] text-[#aab1b8]">Abonnés<input type="number" min="0" value={draft.followers} onChange={event => update('followers', Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded-lg border border-[#2f3336] bg-[#16181c] px-3 py-2 text-sm text-white outline-none" /></label><label className="text-[12px] text-[#aab1b8]">Abonnements<input type="number" min="0" value={draft.following} onChange={event => update('following', Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded-lg border border-[#2f3336] bg-[#16181c] px-3 py-2 text-sm text-white outline-none" /></label></div>
              {account.wikiPageId && <div className="rounded-xl border border-[#2f3336] bg-black/20 p-3 text-[12px] text-[#aab1b8]"><span className="block font-semibold text-white">Article WikiBase associé</span><a href={`${import.meta.env.BASE_URL}page/${account.wikiPageId}`} className="mt-1 block text-[#8ecdf5] hover:underline">{account.wikiPageTitle ?? account.name}</a><p className="mt-1 text-[11px] text-[#71767b]">Cette relation est gérée par WikiBase et ne peut pas être modifiée ici.</p></div>}
              <div className="rounded-xl border border-[#2f3336] p-3"><p className="mb-2 text-[12px] font-bold text-white">Relations synchronisées avec Instagram</p><div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]"><XAccountSearchField accounts={publicAccounts.filter(candidate => candidate.profileId !== account.profileId && !relatedProfileIds.has(candidate.profileId ?? ''))} value={relationHandle} onChange={setRelationHandle} placeholder="Nom ou pseudo…" ariaLabel="Rechercher un compte à relier" /><select value={relationType} onChange={event => setRelationType(event.target.value as InstagramRelationType)} className="rounded-lg border border-[#2f3336] bg-[#16181c] px-2 text-[12px] text-white"><option>coéquipier</option><option>club lié</option><option>rival</option><option>conjoint(e)</option><option>ami proche</option><option>coach</option><option>famille</option><option>sponsor</option><option>partenaire</option></select><button type="button" onClick={addRelation} disabled={!selectedRelation} className="rounded-lg bg-[#1d9bf0] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-40">Ajouter</button></div>{publicAccounts.filter(candidate => candidate.profileId !== account.profileId && !relatedProfileIds.has(candidate.profileId ?? '')).length === 0 && <p className="mt-2 text-[11px] text-[#71767b]">Ajoutez un autre profil public WikiBase pour pouvoir créer une relation.</p>}<div className="mt-2 flex flex-wrap gap-2">{draft.relations.map(relation => { const target = publicAccounts.find(candidate => candidate.profileId === relation.profileId); return target ? <span key={relation.profileId} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white">{target.name} · {relation.type}<button type="button" onClick={() => update('relations', draft.relations.filter(item => item.profileId !== relation.profileId))} className="ml-1.5 text-[#f91880]">×</button></span> : null; })}</div></div>
              {saveError && <p role="alert" className="text-[12px] text-[#f91880]">{saveError}</p>}
              <div className="mt-1 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="rounded-full px-4 py-2 text-[13px] text-[#aab1b8] hover:bg-white/10">Annuler</button><button className="rounded-full bg-[#1d9bf0] px-4 py-2 text-[13px] font-bold text-white">Enregistrer</button></div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function XProfilePage({ account, tweets, relations, onBack, onEdit, onOpenProfile }: {
  account: XAccount | null;
  tweets: XTweet[];
  relations: Array<{ account: XAccount; type: InstagramRelationType }>;
  onBack: () => void;
  onEdit: () => void;
  onOpenProfile: (account: XAccount) => void;
}) {
  const [tab, setTab] = useState<'tweets' | 'replies' | 'likes' | 'retweets'>('tweets');
  const { open: openLightbox } = useContext(LightboxContext);
  if (!account || account.isSystem || !account.profileId) {
    return (
      <div className="min-h-screen bg-black px-4 py-8 text-white">
        <button onClick={onBack} className="mb-8 flex items-center gap-2 text-[14px] text-[#8ecdf5] hover:underline"><ArrowLeft size={17} /> Retour</button>
        <div className="mx-auto max-w-[650px] rounded-2xl border border-[#2f3336] bg-[#16181c] px-6 py-16 text-center">
          <h1 className="text-xl font-bold">Profil introuvable</h1>
          <p className="mt-2 text-sm text-[#71767b]">Ce profil n’est pas un compte public WikiBase.</p>
        </div>
      </div>
    );
  }

  const originals = tweets.filter(tweet => xSameAccount(tweet.acct, account));
  const replies = tweets.flatMap(tweet => tweet.replies.filter(reply => xSameAccount(reply.acct, account)).map(reply => ({ reply, parent: tweet })));
  const likes = tweets.filter(tweet => tweet.likedByHandles?.some(handle => handle.toLowerCase() === account.handle.toLowerCase()));
  const retweets = tweets.filter(tweet => tweet.retweetedByHandles?.some(handle => handle.toLowerCase() === account.handle.toLowerCase()));
  const tabItems: XTweet[] = tab === 'tweets' ? originals : tab === 'likes' ? likes : retweets;
  const profileMedia = { ...account, avatarUrl: account.avatarMedia ? instagramMediaUrl(account.avatarMedia) : account.avatarUrl };
  const avatarSource = profileMedia.avatarUrl;
  const bannerSource = account.bannerMedia ? instagramMediaUrl(account.bannerMedia) : undefined;

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div className="mx-auto min-h-screen w-full max-w-[990px] border-x border-[#2f3336]">
        <header className="sticky top-0 z-20 flex items-center gap-6 border-b border-[#2f3336] bg-black/85 px-4 py-3 backdrop-blur-md">
          <button onClick={onBack} aria-label="Retour au fil Twitter/X" className="rounded-full p-2 hover:bg-white/10"><ArrowLeft size={19} /></button>
          <div><h1 className="font-bold text-[18px]">{account.name}</h1><p className="text-[12px] text-[#71767b]">{originals.length} publication{originals.length !== 1 ? 's' : ''}</p></div>
        </header>
        <section>
          <div className={`relative h-44 bg-gradient-to-r from-[#123a5a] via-[#1d9bf0] to-[#7856ff] sm:h-56 ${bannerSource ? 'cursor-zoom-in' : ''}`}>
            {bannerSource && <button type="button" aria-label={`Agrandir la bannière de ${account.name}`} onClick={() => openLightbox({ src: bannerSource, alt: `Bannière de ${account.name}` })} className="absolute inset-0 h-full w-full cursor-zoom-in">
              <img src={bannerSource} alt="" className="h-full w-full object-cover" />
            </button>}
          </div>
          <div className="px-4 pb-3">
            <div className="relative z-10 -mt-14 flex items-end justify-between sm:-mt-16">
              <button type="button" disabled={!avatarSource} aria-label={`Agrandir la photo de profil de ${account.name}`} onClick={() => avatarSource && openLightbox({ src: avatarSource, alt: `Photo de profil de ${account.name}` })} className={`rounded-full border-4 border-black bg-black ${avatarSource ? 'cursor-zoom-in' : 'cursor-default'}`}>
                <XAvtr acct={profileMedia} size={92} />
              </button>
              {account.profileId && <button onClick={onEdit} className="rounded-full border border-[#536471] px-4 py-2 text-[13px] font-bold hover:bg-white/10"><Pencil size={14} className="mr-1.5 inline" />Éditer le profil</button>}
            </div>
            <div className="mt-3 flex items-center gap-1.5"><h2 className="text-[21px] font-extrabold">{account.name}</h2><XBadgeIcon type={account.badge} /></div>
            <p className="text-[14px] text-[#71767b]">{account.handle}</p>
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-[14px] leading-relaxed">{account.bio || 'Ce compte n’a pas encore de biographie.'}</p>
            {account.wikiPageId && <p className="mt-3 text-[13px] text-[#71767b]">Article WikiBase associé · <a href={`${import.meta.env.BASE_URL}page/${account.wikiPageId}`} className="text-[#8ecdf5] hover:underline">{account.wikiPageTitle ?? account.name}</a></p>}
            <div className="mt-3 flex gap-5 text-[13px] text-[#aab1b8]"><span><b className="text-white">{fmtN(account.following ?? 0)}</b> abonnements</span><span><b className="text-white">{fmtN(account.followers)}</b> abonnés</span></div>
            {relations.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{relations.map(item => <button key={`${item.account.handle}-${item.type}`} onClick={() => onOpenProfile(item.account)} className="rounded-full border border-[#2f3336] px-3 py-1.5 text-[12px] text-[#aab1b8] hover:border-[#1d9bf0] hover:text-white">{item.account.name} · {item.type}</button>)}</div>}
          </div>
        </section>
        <nav className="grid grid-cols-4 border-b border-[#2f3336]" aria-label="Onglets du profil">
          {([
            ['tweets', 'Tweets'],
            ['replies', 'Réponses'],
            ['likes', 'J’aime / Likes'],
            ['retweets', 'Retweets'],
          ] as const).map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`relative py-4 text-[13px] font-semibold ${tab === id ? 'text-white' : 'text-[#71767b] hover:bg-white/[.04]'}`}>{label}{tab === id && <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-[#1d9bf0]" />}</button>)}
        </nav>
        {tab === 'replies' ? (
          replies.length ? <div>{replies.map(({ reply, parent }) => <article key={reply.id} className="border-b border-[#2f3336] px-4 py-4"><div className="flex gap-3"><button onClick={() => onOpenProfile(reply.acct)}><XAvtr acct={reply.acct} size={42} /></button><div className="min-w-0 flex-1"><p className="text-[13px]"><b>{reply.acct.name}</b> <span className="text-[#71767b]">{reply.acct.handle} · {xAgo(reply.ts)}</span></p><p className="mt-1 text-[14px] leading-relaxed"><XTweetText text={reply.text} /></p><p className="mt-2 text-[12px] text-[#71767b]">En réponse à <button onClick={() => onOpenProfile(parent.acct)} className="text-[#8ecdf5] hover:underline">{parent.acct.handle}</button></p></div></div></article>)}</div> : <XProfileEmpty title="Aucune réponse" text="Les réponses de ce profil apparaîtront ici." />
        ) : tabItems.length ? <div>{tabItems.map(tweet => <article key={`${tab}-${tweet.id}`} className="border-b border-[#2f3336] px-4 py-4"><div className="flex gap-3"><button onClick={() => onOpenProfile(tweet.acct)}><XAvtr acct={tweet.acct} size={42} /></button><div className="min-w-0 flex-1"><p className="text-[13px]"><b>{tweet.acct.name}</b> <XBadgeIcon type={tweet.acct.badge} /> <span className="text-[#71767b]">{tweet.acct.handle} · {xAgo(tweet.ts)}</span></p><p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed"><XTweetText text={tweet.text} /></p>{tweet.imageUrl && <img src={tweet.imageUrl} alt="" className="mt-3 max-h-72 rounded-2xl border border-[#2f3336] object-cover" />}<p className="mt-3 text-[12px] text-[#71767b]">{fmtN(tweet.likes)} J’aime · {fmtN(tweet.retweets)} Retweets · {fmtN(tweet.views)} vues</p></div></div></article>)}</div> : <XProfileEmpty title={tab === 'tweets' ? 'Aucun Tweet' : tab === 'likes' ? 'Aucun J’aime' : 'Aucun Retweet'} text={tab === 'tweets' ? 'Ce profil n’a pas encore publié de Tweet.' : 'Les contenus correspondants apparaîtront ici.'} />
        }
      </div>
    </div>
  );
}

function XProfileEmpty({ title, text }: { title: string; text: string }) {
  return <div className="px-6 py-20 text-center"><Archive size={24} className="mx-auto text-[#536471]" /><h3 className="mt-3 text-[17px] font-bold">{title}</h3><p className="mt-1 text-[13px] text-[#71767b]">{text}</p></div>;
}

type XEditTarget = { tweetId: string; replyId?: string } | null;

function XManualReplyComposer({ accounts, tweetId, onSubmit }: { accounts: XAccount[]; tweetId: string; onSubmit: (tweetId: string, author: XAccount, text: string) => void }) {
  const [authorHandle, setAuthorHandle] = useState('');
  const [text, setText] = useState('');
  const author = accounts.find(account => account.handle === authorHandle);
  return (
    <form className="mx-4 mb-3 rounded-xl border border-[#2f3336] bg-[#16181c] p-3" onSubmit={event => {
      event.preventDefault();
      if (author && text.trim()) { onSubmit(tweetId, author, text.trim()); setText(''); }
    }}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8ecdf5]">Ajouter une réponse manuelle</p>
      <XAccountSearchField accounts={accounts} value={authorHandle} onChange={setAuthorHandle} placeholder="Rechercher un profil WikiBase…" ariaLabel="Auteur de la réponse manuelle" />
      <textarea value={text} onChange={event => setText(event.target.value)} rows={2} placeholder="Écrire une réponse…" className="mt-2 w-full resize-none bg-transparent text-[13px] text-white outline-none placeholder:text-[#71767b]" />
      <div className="mt-2 flex justify-end"><button disabled={!author || !text.trim()} className="rounded-full bg-[#1d9bf0] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40">Publier la réponse</button></div>
    </form>
  );
}

function XCard({
  tweet,
  expanded,
  onToggleExpand,
  onLike,
  onRT,
  onSimulate,
  simulateLoading,
  menuId,
  onToggleMenu,
  onEditTweet,
  onDeleteTweet,
  onEditReply,
  onDeleteReply,
  editing,
  editDraft,
  editContext,
  editAiReplyCount,
  onEditDraftChange,
  onEditContextChange,
  onEditAiReplyCountChange,
  onSaveEdit,
  onCancelEdit,
  publicAccounts,
  onManualReply,
  onOpenProfile,
}: {
  tweet: XTweet;
  expanded: boolean;
  onToggleExpand: () => void;
  onLike: () => void;
  onRT: () => void;
  onSimulate: () => void;
  simulateLoading?: boolean;
  menuId: string | null;
  onToggleMenu: (id: string) => void;
  onEditTweet: () => void;
  onDeleteTweet: () => void;
  onEditReply: (reply: XReply) => void;
  onDeleteReply: (replyId: string) => void;
  editing: XEditTarget;
  editDraft: string;
  editContext: string;
  editAiReplyCount: number;
  onEditDraftChange: (value: string) => void;
  onEditContextChange: (value: string) => void;
  onEditAiReplyCountChange: (value: number) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  publicAccounts: XAccount[];
  onManualReply: (author: XAccount, text: string) => void;
  onOpenProfile: (account: XAccount) => void;
}) {
  const showThread = expanded;
  const editingTweet = editing?.tweetId === tweet.id && !editing.replyId;
  const topicLabel = XTOPICS.find(topic => topic.id === (tweet.topic ?? classifyTweetTopic(tweet.text)))?.label ?? 'Divers';
  return (
    <div style={{ borderBottom: '1px solid #2f3336' }}>
      {/* ── Main tweet ── */}
      <div className="flex gap-3 px-4 pt-3 pb-2 hover:bg-white/[0.025] transition-colors">
        {/* Avatar + vertical thread line below */}
        <div className="flex flex-col items-center shrink-0" style={{ width: 44 }}>
          <button onClick={() => onOpenProfile(tweet.acct)} aria-label={`Ouvrir le profil ${tweet.acct.name}`}><XAvtr acct={tweet.acct} size={44} /></button>
          {showThread && <div className="w-0.5 flex-1 bg-[#2f3336] mt-1.5 min-h-[14px]" />}
        </div>
        <div className="flex-1 min-w-0 pb-1">
          <div className="flex items-start gap-1.5 mb-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 flex-wrap leading-none">
               <button onClick={() => onOpenProfile(tweet.acct)} className="font-bold text-[15px] text-white hover:underline">{tweet.acct.name}</button>
              <XBadgeIcon type={tweet.acct.badge} />
               <button onClick={() => onOpenProfile(tweet.acct)} className="text-[#71767b] text-[13px] hover:underline">{tweet.acct.handle}</button><span className="text-[#71767b] text-[13px]">· {xAgo(tweet.ts)}{tweet.editedAt ? ` · Modifié · ${new Date(tweet.editedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
               <span className="rounded-full bg-[#1d9bf0]/10 px-2 py-0.5 text-[10px] font-semibold text-[#8ecdf5]">{topicLabel}</span>
            </div>
            <XTweetMenu
              label={tweet.acct.name}
              open={menuId === `tweet:${tweet.id}`}
              onToggle={() => onToggleMenu(`tweet:${tweet.id}`)}
              onEdit={onEditTweet}
              onDelete={onDeleteTweet}
            />
          </div>
          {editingTweet ? (
            <div className="rounded-xl border border-[#1d9bf0]/60 bg-[#16181c] p-2.5">
              <textarea
                autoFocus
                value={editDraft}
                onChange={event => onEditDraftChange(event.target.value)}
                className="min-h-[76px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-white outline-none"
              />
              <label className="mt-2 block rounded-lg border border-[#2f3336] bg-black/20 px-2.5 py-2">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8ecdf5]">Contexte / Consignes pour l’IA</span>
                <textarea
                  value={editContext}
                  onChange={event => onEditContextChange(event.target.value)}
                  maxLength={700}
                  rows={2}
                  placeholder="Ex. : annonce de transfert surprise, ton de journaliste…"
                  className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-white outline-none placeholder:text-[#71767b]"
                />
              </label>
              <label className="mt-2 flex items-center justify-between rounded-lg border border-[#2f3336] bg-black/20 px-2.5 py-2 text-[12px] text-[#aab1b8]">
                Réponses IA supplémentaires
                <input type="number" min="0" max="8" value={editAiReplyCount} onChange={event => onEditAiReplyCountChange(Math.max(0, Math.min(8, Number(event.target.value) || 0)))} className="w-16 rounded border border-[#536471] bg-black px-2 py-1 text-right text-white outline-none" />
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={onCancelEdit} className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-[#71767b] hover:bg-white/10">Annuler</button>
                <button onClick={onSaveEdit} disabled={!editDraft.trim()} className="rounded-full bg-[#1d9bf0] px-3.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-40">Enregistrer</button>
              </div>
            </div>
          ) : (
            <p className="text-[15px] text-white leading-relaxed whitespace-pre-wrap break-words">
              <XTweetText text={tweet.text} />
            </p>
          )}
          {tweet.imageUrl && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-[#2f3336]" style={{ maxHeight: 280 }}>
              <img src={tweet.imageUrl} alt="" className="w-full object-cover" style={{ maxHeight: 280 }} />
            </div>
          )}
          {/* Action bar — all counters always visible */}
          <div className="flex items-center gap-5 mt-3 text-[#71767b] text-[13px]">
            <button onClick={onToggleExpand} className="flex items-center gap-1.5 hover:text-[#1d9bf0] transition-colors min-w-[36px]">
               <MessageCircle size={16} /><span>{fmtN(tweet.commentCount ?? tweet.replies.length)}</span>
            </button>
            <button onClick={onRT} className="flex items-center gap-1.5 hover:text-[#00ba7c] transition-colors min-w-[36px]" style={{ color: tweet.retweeted ? '#00ba7c' : '#71767b' }}>
              <Repeat2 size={16} /><span>{fmtN(tweet.retweets)}</span>
            </button>
            <button onClick={onLike} className="flex items-center gap-1.5 transition-colors min-w-[36px]" style={{ color: tweet.liked ? '#f91880' : '#71767b' }}>
              <Heart size={16} fill={tweet.liked ? '#f91880' : 'none'} /><span>{fmtN(tweet.likes)}</span>
            </button>
            <span className="flex items-center gap-1.5 min-w-[44px]"><BarChart2 size={15} /><span>{fmtN(tweet.views)}</span></span>
            <button onClick={onSimulate} disabled={simulateLoading} className="flex items-center gap-1 ml-auto hover:text-[#7856ff] transition-colors text-[12px] disabled:opacity-50">
              {simulateLoading
                ? <><svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg><span className="hidden sm:inline ml-0.5">Génération…</span></>
                : <><Sparkles size={13} /><span className="hidden sm:inline ml-0.5">Régénérer</span></>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Replies thread ── */}
      {showThread && (
        <div>
          {(tweet.commentCount ?? tweet.replies.length) > tweet.replies.length && <p className="px-4 pt-2 text-[11px] text-[#71767b]">{tweet.replies.length} interaction{tweet.replies.length > 1 ? 's' : ''} affichée{tweet.replies.length > 1 ? 's' : ''} · environ {fmtN(tweet.commentCount ?? tweet.replies.length)} commentaires au total</p>}
          {tweet.replies.map((r, i) => {
            const isLast = i === tweet.replies.length - 1;
            return (
              <div key={r.id} className="flex gap-2 px-4 pt-2 pb-1.5 hover:bg-white/[0.02] transition-colors">
                {/* Avatar column with thread lines */}
                <div className="flex flex-col items-center shrink-0" style={{ width: 44 }}>
                  <div className="w-0.5 h-2 bg-[#2f3336]" />
                   <button onClick={() => onOpenProfile(r.acct)} aria-label={`Ouvrir le profil ${r.acct.name}`}><XAvtr acct={r.acct} size={32} /></button>
                  {!isLast && <div className="w-0.5 flex-1 bg-[#2f3336] mt-1.5 min-h-[8px]" />}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-start gap-1.5 mb-1">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] flex-wrap leading-none">
                       <button onClick={() => onOpenProfile(r.acct)} className="font-bold text-white hover:underline">{r.acct.name}</button>
                      <XBadgeIcon type={r.acct.badge} />
                       <button onClick={() => onOpenProfile(r.acct)} className="text-[#71767b] hover:underline">{r.acct.handle}</button><span className="text-[#71767b]">· {xAgo(r.ts)}{r.editedAt ? ` · Modifié · ${new Date(r.editedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                    </div>
                    <XTweetMenu
                      label={r.acct.name}
                      open={menuId === `reply:${tweet.id}:${r.id}`}
                      onToggle={() => onToggleMenu(`reply:${tweet.id}:${r.id}`)}
                      onEdit={() => onEditReply(r)}
                      onDelete={() => onDeleteReply(r.id)}
                    />
                  </div>
                  {editing?.tweetId === tweet.id && editing.replyId === r.id ? (
                    <div className="rounded-xl border border-[#1d9bf0]/60 bg-[#16181c] p-2.5">
                      <textarea
                        autoFocus
                        value={editDraft}
                        onChange={event => onEditDraftChange(event.target.value)}
                        className="min-h-[64px] w-full resize-none bg-transparent text-[14px] leading-relaxed text-white outline-none"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button onClick={onCancelEdit} className="rounded-full px-3 py-1 text-[11px] font-semibold text-[#71767b] hover:bg-white/10">Annuler</button>
                        <button onClick={onSaveEdit} disabled={!editDraft.trim()} className="rounded-full bg-[#1d9bf0] px-3 py-1 text-[11px] font-bold text-white disabled:opacity-40">Enregistrer</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[14px] text-white leading-relaxed">
                      <XTweetText text={r.text} />
                    </p>
                  )}
                  <div className="flex gap-5 mt-2 text-[#71767b] text-[12px] items-center">
                    <span className="flex items-center gap-1"><MessageCircle size={12} /></span>
                    <span className="flex items-center gap-1"><Heart size={12} /><span>{r.likes}</span></span>
                    <span className="flex items-center gap-1"><Repeat2 size={12} /></span>
                    <span className="flex items-center gap-1 ml-auto"><BarChart2 size={11} /><span>{fmtN(r.views ?? engagementFor(r.acct, r.id).views)}</span></span>
                  </div>
                </div>
              </div>
            );
          })}
          <XManualReplyComposer accounts={publicAccounts} tweetId={tweet.id} onSubmit={(_, author, text) => onManualReply(author, text)} />
        </div>
      )}
    </div>
  );
}

function TwitterWorkspace({ pages }: { pages: WikiPage[] }) {
  const [, navigate] = useLocation();
  const params = useParams<{ handle?: string }>();
  const isProfileRoute = params.handle !== undefined;
  const routeProfileHandle = decodeTwitterRouteHandle(params.handle);

  const [socialDatabase, setSocialDatabase] = useState(() => loadInstagramDatabase(pages));
  useEffect(() => {
    setSocialDatabase(loadInstagramDatabase(pages));
  }, [pages]);

  const profileByWikiId = useMemo(() => new Map(socialDatabase.profiles.filter(profile => profile.wikiPageId).map(profile => [profile.wikiPageId!, profile])), [socialDatabase.profiles]);
  const wikiAccountDrafts = useMemo(() => pages.filter(page => !page.isTrashed).map(page => wikiToXAcct(page, profileByWikiId.get(page.id))), [pages, profileByWikiId]);
  const handleByProfileId = useMemo(() => new Map(wikiAccountDrafts.filter(account => account.profileId).map(account => [account.profileId!, account.handle])), [wikiAccountDrafts]);
  const wikiAccts = useMemo(() => wikiAccountDrafts.map(account => {
    const profile = account.profileId ? socialDatabase.profiles.find(item => item.id === account.profileId) : undefined;
    const sharedRelations = profile?.relations
      .map(relation => handleByProfileId.get(relation.profileId))
      .filter((handle): handle is string => Boolean(handle)) ?? [];
    return { ...account, relatedHandles: sharedRelations.length > 0 ? sharedRelations : account.relatedHandles };
  }), [handleByProfileId, socialDatabase.profiles, wikiAccountDrafts]);
  const publicAccounts = useMemo(() => wikiAccts.filter(account => !account.isSystem), [wikiAccts]);
  const dynamicFanAccts = useMemo(() => wikiAccts.slice(0, 3).flatMap(acct =>
    TWITTER_ACCOUNT_TEMPLATES.CLUB_ACTU.slice(0, 2).map(suffix => {
      const handle = `${acct.handle}${suffix}`.replace(/[^@a-zA-Z0-9_]/g, '');
      return {
        handle,
        name: `${acct.name} ${suffix}`,
        initials: xInits(acct.name),
        avatarColor: xColor(`${acct.name}${suffix}`),
        badge: null,
        category: 'WIKI_OFFICIAL' as const,
        followers: followersForAccount({ handle, category: 'WIKI_OFFICIAL', isSystem: true }),
        isSystem: true,
      };
    }),
  ), [wikiAccts]);
  const allAccts  = useMemo(() => uniqueXAccounts([...publicAccounts, ...XMEDIA, ...XREGISTRY, ...XSOCIAL_REFERENCE, ...dynamicFanAccts]), [publicAccounts, dynamicFanAccts]);

  const [tweets, setTweetsState] = useState<XTweet[]>(() => {
    try {
      const stored = localStorage.getItem(XSTORAGE);
      const parsed = stored ? JSON.parse(stored) : null;
      if (Array.isArray(parsed)) return parsed.map(tweet => normalizeTweet(tweet as XTweet));
    } catch {}
    return XINIT.map(normalizeTweet);
  });
  const setTweets = (t: XTweet[]) => { setTweetsState(t); localStorage.setItem(XSTORAGE, JSON.stringify(t)); };

  const [tab, setTab]           = useState<'foryou' | 'following' | 'discovery'>('foryou');
  const [topicFilter, setTopicFilter] = useState<'ALL' | XFeedTopic>('ALL');
  const [draft, setDraft]       = useState('');
  const [composeContext, setComposeContext] = useState('');
  const [authorHandle, setAuthorHandle] = useState('');
  const [authorError, setAuthorError] = useState('');
  const [aiReplyCount, setAiReplyCount] = useState(2);
  const [imgUrl, setImgUrl]     = useState('');
  const [imgOpen, setImgOpen]   = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgUploadError, setImgUploadError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set());
  const [aiPosting, setAiPosting] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<XEditTarget>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editContext, setEditContext] = useState('');
  const [editAiReplyCount, setEditAiReplyCount] = useState(2);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [discoverySeed] = useState(() => Math.floor(Date.now() / 60_000));

  useEffect(() => {
    const byIdentity = new Map(allAccts.flatMap(account => [[account.handle.toLowerCase(), account], ...(account.profileId ? [[`profile:${account.profileId}`, account] as const] : [])]));
    setTweetsState(previous => {
      const next = previous.map(tweet => ({
        ...tweet,
        acct: byIdentity.get(tweet.acct.profileId ? `profile:${tweet.acct.profileId}` : tweet.acct.handle.toLowerCase()) ?? tweet.acct,
        replies: tweet.replies.map(reply => ({ ...reply, acct: byIdentity.get(reply.acct.profileId ? `profile:${reply.acct.profileId}` : reply.acct.handle.toLowerCase()) ?? reply.acct })),
      }));
      localStorage.setItem(XSTORAGE, JSON.stringify(next));
      return next;
    });
  }, [allAccts]);

  const author = publicAccounts.find(account => account.handle === authorHandle) ?? XINIT[0].acct;
  const displayed = useMemo(() => {
    const filtered = tweets
      .filter(tweet => tab !== 'following' || !tweet.acct.isSystem)
      .filter(tweet => topicFilter === 'ALL' || (tweet.topic ?? classifyTweetTopic(tweet.text)) === topicFilter);
    return tab === 'discovery'
      ? [...filtered].sort((a, b) => xHash(`${discoverySeed}:${a.id}`) - xHash(`${discoverySeed}:${b.id}`))
      : filtered;
  }, [tweets, tab, topicFilter, discoverySeed]);
  const publicSearchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return publicAccounts.filter(account => `${account.name} ${account.handle}`.toLowerCase().includes(query)).slice(0, 5);
  }, [publicAccounts, searchTerm]);

  // Fetches AI-generated replies from the backend and maps them to XReply[]
  const fetchAIReplies = async (
    tweetText: string,
    tweetAuthor: XAccount,
    existingReplies: XReply[],
    editorContext = '',
    additionalReplyCount = 2,
  ): Promise<XReply[]> => {
    const mentions = extractMentions(tweetText);
    const alreadyReplied = new Set(existingReplies.map(r => r.acct.handle.toLowerCase()));
    const topic = classifyTweetTopic(`${tweetText} ${editorContext}`);
    const knownMentions = mentions
      .map(handle => allAccts.find(acct => acct.handle.toLowerCase() === handle.toLowerCase()))
      .filter((acct): acct is XAccount => Boolean(acct))
      .filter(acct => acct.handle.toLowerCase() !== tweetAuthor.handle.toLowerCase())
      .filter(acct => !alreadyReplied.has(acct.handle.toLowerCase()));
    const relatedAccounts = (tweetAuthor.relatedHandles ?? [])
      .map(handle => allAccts.find(acct => acct.handle.toLowerCase() === handle.toLowerCase()))
      .filter((acct): acct is XAccount => Boolean(acct))
      .filter(acct => acct.handle.toLowerCase() !== tweetAuthor.handle.toLowerCase())
      .filter(acct => !alreadyReplied.has(acct.handle.toLowerCase()));
    const requiredAccounts = uniqueXAccounts([...knownMentions, ...relatedAccounts]);
    const requestedExtras = Math.max(0, Math.min(8, Math.round(additionalReplyCount)));
    const targetReplyCount = requiredAccounts.length + requestedExtras;
    const contextualAccounts = allAccts
      .filter(acct => contextCategories(topic).includes(acct.category))
      .filter(acct => acct.handle.toLowerCase() !== tweetAuthor.handle.toLowerCase())
      .filter(acct => !alreadyReplied.has(acct.handle.toLowerCase()));
    const candidates = uniqueXAccounts([...requiredAccounts, ...contextualAccounts]).slice(0, 70);
    const makeReply = (acct: XAccount, content: string, id: string): XReply => ({
      id,
      acct,
      text: content,
      ...engagementFor(acct, id),
      ts: Date.now() - Math.floor(Math.random() * 180000),
      engagementVersion: 1,
      source: 'ai',
    });
    const buildFallback = (limit = targetReplyCount) => {
      const required = requiredAccounts.map((acct, index) =>
        makeReply(acct, genMentionReply(acct, tweetText, tweetAuthor), `xr_fb_mention_${Date.now()}_${index}`),
      );
      const used = new Set([tweetAuthor.handle.toLowerCase(), ...required.map(reply => reply.acct.handle.toLowerCase()), ...alreadyReplied]);
      const extras = candidates
        .filter(acct => !used.has(acct.handle.toLowerCase()))
        .slice(0, Math.max(0, limit - required.length))
        .map((acct, index) => makeReply(acct, xReplyTpl(tweetAuthor.name)[index % xReplyTpl(tweetAuthor.name).length], `xr_fb_context_${Date.now()}_${index}`));
      return [...required, ...extras];
    };
    try {
      const res = await fetch('/api/generate-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweetText,
          author: { handle: tweetAuthor.handle, name: tweetAuthor.name, badge: tweetAuthor.badge },
          mentions,
          relations: relatedAccounts.map(account => account.handle),
          topic,
          context: editorContext,
          additionalReplyCount: requestedExtras,
          availableAccounts: candidates.map(a => ({ handle: a.handle, name: a.name, badge: a.badge, category: a.category, country: a.country, isSystem: a.isSystem })),
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json() as { replies: Array<{ handle: string; name: string; content: string }> };
      const returned = new Map<string, { handle: string; name: string; content: string }>();
      const rawReplies = Array.isArray(data.replies) ? data.replies : [];
      for (const r of rawReplies) {
        if (!r || typeof r.handle !== 'string' || typeof r.name !== 'string' || typeof r.content !== 'string') continue;
        const normalHandle = r.handle.startsWith('@') ? r.handle : `@${r.handle}`;
        if (!alreadyReplied.has(normalHandle.toLowerCase()) && r.content?.trim()) {
          returned.set(normalHandle.toLowerCase(), { ...r, handle: normalHandle });
        }
      }
      const requiredReplies = requiredAccounts.map((acct, index) => {
        const generated = returned.get(acct.handle.toLowerCase());
        return makeReply(acct, generated?.content?.trim() || genMentionReply(acct, tweetText, tweetAuthor), `xr_ai_mention_${Date.now()}_${index}`);
      });
      const used = new Set([tweetAuthor.handle.toLowerCase(), ...alreadyReplied, ...requiredReplies.map(reply => reply.acct.handle.toLowerCase())]);
      const regularReplies = [...returned.values()]
        .map(reply => ({ reply, acct: candidates.find(acct => acct.handle.toLowerCase() === reply.handle.toLowerCase()) }))
        .filter((value): value is { reply: { handle: string; name: string; content: string }; acct: XAccount } => Boolean(value.acct))
        .filter(value => !used.has(value.acct.handle.toLowerCase()))
        .slice(0, Math.max(0, targetReplyCount - requiredReplies.length))
        .map((value, index) => makeReply(value.acct, value.reply.content.trim(), `xr_ai_context_${Date.now()}_${index}`));
      const resolved = [...requiredReplies, ...regularReplies];
      return resolved.length >= requiredAccounts.length ? resolved : buildFallback();
    } catch {
      return buildFallback();
    }
  };

  const postTweet = async () => {
    if (!draft.trim() || aiPosting) return;
    if (!publicAccounts.some(account => account.handle === authorHandle)) {
      setAuthorError('Sélectionnez volontairement un profil public WikiBase dans les suggestions avant de publier.');
      return;
    }
    const text = draft.trim();
    const imageUrl = imgUrl.trim() || undefined;
    const aiContext = composeContext.trim() || undefined;
    const tweetId = `xt_${Date.now()}`;
    const t: XTweet = {
      id: tweetId,
      acct: author,
      text,
      imageUrl,
      ts: Date.now(),
      ...engagementFor(author, tweetId),
      liked: false,
      retweeted: false,
      replies: [],
      topic: classifyTweetTopic(`${text} ${aiContext ?? ''}`),
      aiContext,
      aiReplyCount: Math.max(0, Math.min(8, Math.round(aiReplyCount))),
      commentCount: simulatedCommentCount(author, tweetId),
      engagementVersion: 1,
    };
    setTweets([t, ...tweets]);
    setDraft(''); setComposeContext(''); setImgUrl('');
    setAuthorError('');
    setAiPosting(true);
    const aiReplies = await fetchAIReplies(text, author, [], aiContext, aiReplyCount);
    setAiPosting(false);
    if (aiReplies.length > 0) {
      setTweetsState(prev => {
        const updated = prev.map(tw => tw.id === tweetId ? { ...tw, replies: aiReplies } : tw);
        localStorage.setItem(XSTORAGE, JSON.stringify(updated));
        return updated;
      });
      setExpanded(prev => new Set([...prev, tweetId]));
    }
  };

  const interactionHandle = publicAccounts.some(account => account.handle === authorHandle) ? authorHandle : '@viewer';
  const toggleLike = (id: string) => setTweets(tweets.map(t => {
    if (t.id !== id) return t;
    const actors = t.likedByHandles ?? [];
    const active = actors.some(handle => handle.toLowerCase() === interactionHandle.toLowerCase());
    return {
      ...t,
      liked: !active,
      likes: Math.max(0, t.likes + (active ? -1 : 1)),
      likedByHandles: active ? actors.filter(handle => handle.toLowerCase() !== interactionHandle.toLowerCase()) : [...actors, interactionHandle],
    };
  }));
  const toggleRT = (id: string) => setTweets(tweets.map(t => {
    if (t.id !== id) return t;
    const actors = t.retweetedByHandles ?? [];
    const active = actors.some(handle => handle.toLowerCase() === interactionHandle.toLowerCase());
    return {
      ...t,
      retweeted: !active,
      retweets: Math.max(0, t.retweets + (active ? -1 : 1)),
      retweetedByHandles: active ? actors.filter(handle => handle.toLowerCase() !== interactionHandle.toLowerCase()) : [...actors, interactionHandle],
    };
  }));

  const beginEdit = (tweetId: string, reply?: XReply) => {
    const tweet = tweets.find(item => item.id === tweetId);
    if (!tweet) return;
    setMenuId(null);
    setEditing({ tweetId, ...(reply ? { replyId: reply.id } : {}) });
    setEditDraft(reply?.text ?? tweet.text);
    setEditContext(reply ? '' : tweet.aiContext ?? '');
    setEditAiReplyCount(tweet.aiReplyCount ?? 2);
  };
  const cancelEdit = () => { setEditing(null); setEditDraft(''); setEditContext(''); setEditAiReplyCount(2); };
  const saveEdit = () => {
    if (!editing || !editDraft.trim()) return;
    const updated = tweets.map(tweet => {
      if (tweet.id !== editing.tweetId) return tweet;
      if (!editing.replyId) {
        const aiContext = editContext.trim() || undefined;
        return {
          ...tweet,
          text: editDraft.trim(),
          aiContext,
          aiReplyCount: Math.max(0, Math.min(8, Math.round(editAiReplyCount))),
          topic: classifyTweetTopic(`${editDraft.trim()} ${aiContext ?? ''}`),
          editedAt: Date.now(),
        };
      }
      return {
        ...tweet,
        replies: tweet.replies.map(reply => reply.id === editing.replyId ? { ...reply, text: editDraft.trim(), editedAt: Date.now() } : reply),
      };
    });
    setTweets(updated);
    cancelEdit();
  };
  const deleteTweet = (id: string) => {
    setTweets(tweets.filter(tweet => tweet.id !== id));
    setExpanded(prev => { const next = new Set(prev); next.delete(id); return next; });
    setMenuId(null);
  };
  const deleteReply = (tweetId: string, replyId: string) => {
    setTweets(tweets.map(tweet => tweet.id === tweetId ? { ...tweet, replies: tweet.replies.filter(reply => reply.id !== replyId) } : tweet));
    setMenuId(null);
  };

  const simulate = async (id: string) => {
    const tw = tweets.find(t => t.id === id); if (!tw) return;
    if (aiLoading.has(id)) return;
    setAiLoading(prev => new Set([...prev, id]));
    setExpanded(prev => new Set([...prev, id]));
    const manualReplies = tw.replies.filter(reply => reply.source === 'manual');
    const aiReplies = await fetchAIReplies(tw.text, tw.acct, manualReplies, tw.aiContext, tw.aiReplyCount ?? 2);
    setAiLoading(prev => { const s = new Set(prev); s.delete(id); return s; });
    if (aiReplies.length > 0) {
      setTweetsState(prev => {
        const updated = prev.map(t => t.id === id ? { ...t, replies: [...manualReplies, ...aiReplies], commentCount: Math.max(t.commentCount ?? 0, manualReplies.length + aiReplies.length) } : t);
        localStorage.setItem(XSTORAGE, JSON.stringify(updated));
        return updated;
      });
    }
  };

  const addManualReply = (tweetId: string, replyAuthor: XAccount, text: string) => {
    const replyId = `xr_manual_${Date.now()}`;
    const reply: XReply = { id: replyId, acct: replyAuthor, text, ...engagementFor(replyAuthor, replyId), ts: Date.now(), engagementVersion: 1, source: 'manual' };
    setTweets(tweets.map(tweet => tweet.id === tweetId ? {
      ...tweet,
      replies: [...tweet.replies, reply],
      commentCount: Math.max(tweet.commentCount ?? 0, tweet.replies.length + 1),
    } : tweet));
    setExpanded(previous => new Set([...previous, tweetId]));
  };

  const selectedProfileAccount = routeProfileHandle
    ? publicAccounts.find(account => account.handle.toLowerCase() === routeProfileHandle.toLowerCase()) ?? null
    : null;
  const selectedProfileRelations = useMemo(() => {
    if (!selectedProfileAccount?.profileId) return [];
    const profile = socialDatabase.profiles.find(item => item.id === selectedProfileAccount.profileId);
    return (profile?.relations ?? []).flatMap(relation => {
      const account = publicAccounts.find(candidate => candidate.profileId === relation.profileId);
      return account ? [{ account, type: relation.type }] : [];
    });
  }, [publicAccounts, selectedProfileAccount, socialDatabase.profiles]);
  const selectedProfileTweetCount = selectedProfileAccount ? tweets.filter(tweet => tweet.acct.profileId === selectedProfileAccount.profileId || tweet.acct.handle === selectedProfileAccount.handle).length : 0;
  const selectedProfileReplyCount = selectedProfileAccount ? tweets.reduce((total, tweet) => total + tweet.replies.filter(reply => reply.acct.profileId === selectedProfileAccount.profileId || reply.acct.handle === selectedProfileAccount.handle).length, 0) : 0;
  const takenHandles = useMemo(() => [
    ...publicAccounts.filter(candidate => candidate.profileId !== selectedProfileAccount?.profileId).map(candidate => candidate.handle),
    ...XMEDIA.map(candidate => candidate.handle),
    ...XREGISTRY.map(candidate => candidate.handle),
    ...XSOCIAL_REFERENCE.map(candidate => candidate.handle),
    ...dynamicFanAccts.map(candidate => candidate.handle),
    ...tweets.flatMap(tweet => [tweet.acct, ...tweet.replies.map(reply => reply.acct)])
      .filter(candidate => candidate.profileId !== selectedProfileAccount?.profileId)
      .map(candidate => candidate.handle),
  ], [dynamicFanAccts, publicAccounts, selectedProfileAccount?.profileId, tweets]);

  const saveTwitterProfile = (draftProfile: XProfileEditDraft) => {
    if (!selectedProfileAccount?.profileId) return;
    const currentProfile = socialDatabase.profiles.find(profile => profile.id === selectedProfileAccount.profileId);
    if (!currentProfile) return;
    const nextHandle = normalizeTwitterHandle(draftProfile.handle) ?? normalizeTwitterHandle(currentProfile.twitter?.handle) ?? normalizeTwitterHandle(currentProfile.username);
    if (!nextHandle || isTwitterHandleTaken(nextHandle, selectedProfileAccount.handle, takenHandles)) return;
    const avatarMedia = xCanonicalMedia(draftProfile.avatarUrl);
    const bannerMedia = xCanonicalMedia(draftProfile.bannerUrl);
    const updatedInstagramProfile: InstagramProfile = {
      ...currentProfile,
      displayName: draftProfile.name.trim() || currentProfile.displayName,
      bio: draftProfile.bio.trim(),
      avatar: avatarMedia ?? currentProfile.avatar,
      followers: Math.max(0, Math.round(draftProfile.followers)),
      following: Math.max(0, Math.round(draftProfile.following)),
      relations: draftProfile.relations,
    };
    const withRelations = updateInstagramProfile(socialDatabase, updatedInstagramProfile);
    const next = {
      ...withRelations,
      profiles: withRelations.profiles.map(profile => profile.id === currentProfile.id ? {
        ...profile,
        twitter: {
          ...profile.twitter,
          handle: nextHandle,
          bio: draftProfile.bio.trim() || undefined,
          avatar: avatarMedia ?? profile.twitter?.avatar,
          banner: bannerMedia ?? profile.twitter?.banner,
          followers: Math.max(0, Math.round(draftProfile.followers)),
          following: Math.max(0, Math.round(draftProfile.following)),
        },
      } : profile),
    };
    saveInstagramDatabase(next, 'twitter');
    setSocialDatabase(next);
    setProfileEditorOpen(false);
    navigate(`/twitter/profile/${encodeURIComponent(nextHandle)}`);
  };

  if (isProfileRoute) {
    return (
      <>
        <XProfilePage
          account={selectedProfileAccount}
          tweets={tweets}
          relations={selectedProfileRelations}
          onBack={() => navigate('/twitter')}
          onEdit={() => setProfileEditorOpen(true)}
          onOpenProfile={account => account.profileId && !account.isSystem ? navigate(`/twitter/profile/${encodeURIComponent(account.handle)}`) : undefined}
        />
        {profileEditorOpen && <XProfileModal
          account={selectedProfileAccount}
          publicAccounts={publicAccounts}
          takenHandles={takenHandles}
          relationItems={selectedProfileRelations}
          tweetCount={selectedProfileTweetCount}
          replyCount={selectedProfileReplyCount}
          onClose={() => setProfileEditorOpen(false)}
          onSave={saveTwitterProfile}
        />}
      </>
    );
  }

  const BASE      = import.meta.env.BASE_URL.replace(/\/$/, '');
  const knownImgs = [
    ...['logo1.png','site_logo.png','oriabank.png','airways2.jpg','airways.jpg'].map(f => ({ name: f, url: `${BASE}/images/${f}` })),
    ...getUploadedMedia().map(item => ({ name: `Médiathèque · ${item.filename}`, url: item.path })),
  ];

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>

      {/* ── LEFT NAV ─────────────────────────────────────────── */}
      <nav className="hidden md:flex flex-col w-[68px] xl:w-[258px] h-full py-3 px-2 xl:px-4 border-r border-[#2f3336] shrink-0">
        <div className="p-3 mb-1">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </div>
        {[{e:'🏠',l:'Accueil',a:true},{e:'🔍',l:'Explorer'},{e:'🔔',l:'Notifications'},{e:'👤',l:'Profil'}].map(item => (
           <button key={item.l} onClick={() => item.l === 'Profil' && publicAccounts.some(account => account.handle === author.handle) ? navigate(`/twitter/profile/${encodeURIComponent(author.handle)}`) : undefined} className="flex items-center gap-4 px-3 py-3.5 rounded-full hover:bg-white/10 transition-colors text-left w-full" style={{ color: item.a ? '#fff' : '#e7e9ea' }}>
            <span className="text-xl leading-none w-6 text-center">{item.e}</span>
            <span className="hidden xl:block text-[18px] font-medium">{item.l}</span>
          </button>
        ))}
        <button onClick={() => document.getElementById('x-compose-area')?.focus()} className="mt-4 h-12 w-12 xl:w-full rounded-full bg-[#1d9bf0] text-white font-bold text-[15px] hover:bg-[#1a8cd8] transition-colors flex items-center justify-center gap-2 self-start xl:self-stretch">
          <span className="xl:hidden text-xl">✎</span><span className="hidden xl:block">Poster</span>
        </button>
        <div className="flex-1" />
        <button onClick={() => navigate('/')} className="flex items-center gap-3 px-3 py-3 rounded-full hover:bg-white/10 transition-colors text-[#71767b] hover:text-white w-full">
          <ArrowLeft size={20} className="shrink-0" /><span className="hidden xl:block text-[15px]">Retour au Hub</span>
        </button>
      </nav>

      {/* ── CENTER ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[#2f3336]" style={{ maxWidth: 598 }}>
        {/* Sticky header */}
        <div className="sticky top-0 z-20 backdrop-blur-md bg-black/75 border-b border-[#2f3336]">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="font-bold text-[19px]">Accueil</h1>
            <button onClick={() => navigate('/')} className="md:hidden text-[#1d9bf0] text-sm font-semibold flex items-center gap-1"><ArrowLeft size={14}/>Hub</button>
          </div>
          <div className="flex">
            {(['foryou','following','discovery'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className="flex-1 py-3 text-[14px] font-medium hover:bg-white/5 transition-colors relative" style={{ color: tab === t ? '#fff' : '#71767b' }}>
                {t === 'foryou' ? 'Pour vous' : t === 'following' ? 'Abonnements' : 'Découverte'}
                {tab === t && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-16 rounded-full bg-[#1d9bf0]" />}
              </button>
            ))}
          </div>
           <div className="flex gap-2 overflow-x-auto px-4 pb-2.5 pt-1.5">
             {XTOPICS.map(topic => (
               <button
                 key={topic.id}
                 onClick={() => setTopicFilter(topic.id)}
                 className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
                 style={{ background: topicFilter === topic.id ? '#1d9bf0' : '#202327', color: topicFilter === topic.id ? '#fff' : '#aab1b8' }}
               >
                 {topic.label}
               </button>
             ))}
           </div>
        </div>

        {/* Composer */}
        <div className="px-4 pt-4 pb-3 border-b border-[#2f3336]">
          <div className="flex gap-3">
            <XAvtr acct={author} size={44} />
            <div className="flex-1 min-w-0">
               {publicAccounts.length > 0 && (
                <label className="mb-2 block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#71767b]">Auteur public WikiBase</span>
                  <XAuthorField
                    accounts={publicAccounts}
                    value={authorHandle}
                    onChange={handle => { setAuthorHandle(handle); if (handle) setAuthorError(''); }}
                    placeholder="Tapez un nom ou un pseudo, puis choisissez une suggestion…"
                    ariaLabel="Rechercher l’auteur du tweet"
                  />
                  {authorError && <p role="alert" className="mt-1.5 text-[11px] text-[#f91880]">{authorError}</p>}
                </label>
              )}
              <textarea id="x-compose-area" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postTweet(); }}
                placeholder="Quoi de neuf ?" rows={draft.length > 80 ? 3 : 2}
                className="w-full bg-transparent text-[18px] placeholder-[#71767b] outline-none resize-none leading-relaxed" />
               <label className="mt-2 block rounded-xl border border-[#2f3336] bg-[#16181c] px-3 py-2">
                 <span className="mb-1 block text-[11px] font-semibold text-[#8ecdf5]">Contexte / Consignes pour l’IA <span className="font-normal text-[#71767b]">· optionnel</span></span>
                 <textarea
                   value={composeContext}
                   onChange={event => setComposeContext(event.target.value)}
                   maxLength={700}
                   rows={composeContext.length > 140 ? 3 : 2}
                   placeholder="Ex. : Je veux un clash entre un journaliste et un supporter énervé, ou une annonce de transfert surprise."
                   className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-white outline-none placeholder:text-[#71767b]"
                 />
               </label>
               <label className="mt-2 flex items-center justify-between rounded-xl border border-[#2f3336] bg-[#16181c] px-3 py-2 text-[12px] text-[#aab1b8]">
                 Réponses IA supplémentaires à générer
                 <input type="number" min="0" max="8" value={aiReplyCount} onChange={event => setAiReplyCount(Math.max(0, Math.min(8, Number(event.target.value) || 0)))} className="w-16 rounded-lg border border-[#536471] bg-black px-2 py-1.5 text-right text-sm text-white outline-none" />
               </label>
              {imgUrl && (
                <div className="relative mt-2 rounded-2xl overflow-hidden border border-[#2f3336]" style={{ maxHeight: 200 }}>
                  <img src={imgUrl} alt="" className="w-full object-cover" style={{ maxHeight: 200 }} />
                  <button onClick={() => setImgUrl('')} className="absolute top-2 right-2 bg-black/70 rounded-full p-1.5"><X size={13}/></button>
                </div>
              )}
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#2f3336]">
                <div className="relative">
                  <button onClick={() => setImgOpen(v => !v)} className="text-[#1d9bf0] p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors"><ImageIcon size={18}/></button>
                  {imgOpen && (
                    <div className="absolute left-0 top-10 z-30 bg-[#1c2938] border border-[#2f3336] rounded-2xl shadow-2xl p-3" style={{ minWidth: 210 }}>
                      <p className="text-[10px] text-[#71767b] mb-2 uppercase tracking-wider">Images disponibles</p>
                      {knownImgs.map(im => (
                        <button key={im.name} onClick={() => { setImgUrl(im.url); setImgOpen(false); }} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-white/10 text-left text-sm text-white">
                          <img src={im.url} alt="" className="w-7 h-7 rounded object-cover shrink-0"/>{im.name}
                        </button>
                      ))}
                      <div className="mt-2 pt-2 border-t border-[#2f3336]">
                         <label className={`flex items-center justify-center gap-1.5 mb-2 rounded-lg border border-dashed border-[#1d9bf0]/60 px-2 py-1.5 text-xs text-[#1d9bf0] cursor-pointer ${imgUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                           <Upload size={14} /> {imgUploading ? 'Import en cours…' : 'Importer depuis mon ordinateur'}
                           <input type="file" accept=".jpg,.jpeg,.png,.webp,.svg,image/*" className="hidden" disabled={imgUploading} onChange={async event => {
                             const file = event.target.files?.[0]; event.currentTarget.value = '';
                             if (!file) return;
                             setImgUploading(true); setImgUploadError('');
                             try { const uploaded = await uploadMedia(file, 'twitter'); setImgUrl(uploaded.path); setImgOpen(false); }
                             catch (error) { setImgUploadError(error instanceof Error ? error.message : 'Import impossible.'); }
                             finally { setImgUploading(false); }
                           }} />
                         </label>
                         {imgUploadError && <p className="text-[10px] text-[#f4212e] mb-2">{imgUploadError}</p>}
                        <input type="text" placeholder="URL d'image..." value={imgUrl} onChange={e => setImgUrl(e.target.value)} className="w-full bg-transparent text-[12px] text-white placeholder-[#71767b] outline-none px-2 py-1 border border-[#2f3336] rounded-lg"/>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px]" style={{ color: draft.length > 260 ? '#f4212e' : '#71767b' }}>{280 - draft.length}</span>
                  <button onClick={postTweet} disabled={!draft.trim() || aiPosting} className="bg-[#1d9bf0] text-white font-bold px-5 py-1.5 rounded-full text-[15px] hover:bg-[#1a8cd8] transition-colors disabled:opacity-40 flex items-center gap-2">
                    {aiPosting && <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>}
                    {aiPosting ? 'Publication…' : 'Poster'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="overflow-y-auto flex-1">
          {displayed.length === 0 && <div className="py-16 text-center text-[#71767b]"><p className="text-4xl mb-3">📭</p><p>Aucun tweet. Soyez le premier à poster !</p></div>}
          {displayed.map(t => (
            <XCard key={t.id} tweet={t} expanded={expanded.has(t.id)}
              onToggleExpand={() => setExpanded(prev => { const s = new Set(prev); s.has(t.id) ? s.delete(t.id) : s.add(t.id); return s; })}
              onLike={() => toggleLike(t.id)} onRT={() => toggleRT(t.id)} onSimulate={() => simulate(t.id)}
              simulateLoading={aiLoading.has(t.id)}
              menuId={menuId}
              onToggleMenu={id => setMenuId(current => current === id ? null : id)}
              onEditTweet={() => beginEdit(t.id)}
              onDeleteTweet={() => deleteTweet(t.id)}
              onEditReply={reply => beginEdit(t.id, reply)}
              onDeleteReply={replyId => deleteReply(t.id, replyId)}
              editing={editing}
              editDraft={editDraft}
              editContext={editContext}
              editAiReplyCount={editAiReplyCount}
              onEditDraftChange={setEditDraft}
              onEditContextChange={setEditContext}
              onEditAiReplyCountChange={setEditAiReplyCount}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              publicAccounts={publicAccounts}
              onManualReply={(replyAuthor, text) => addManualReply(t.id, replyAuthor, text)}
              onOpenProfile={account => account.profileId && !account.isSystem ? navigate(`/twitter/profile/${encodeURIComponent(account.handle)}`) : undefined}
            />
          ))}
        </div>
      </div>

      {/* ── RIGHT SIDEBAR ────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[340px] h-full px-4 py-4 overflow-y-auto shrink-0 gap-4">
        <div className="relative">
          <div className="flex items-center gap-3 bg-[#202327] rounded-full px-4 py-2.5">
            <Search size={15} className="text-[#71767b] shrink-0"/>
            <input
              type="search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Rechercher un compte public"
              className="bg-transparent text-sm outline-none flex-1 placeholder-[#71767b] text-white"
            />
          </div>
          {searchTerm.trim() && (
            <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-xl border border-[#2f3336] bg-[#16181c] shadow-2xl">
              {publicSearchResults.length > 0 ? publicSearchResults.map(account => (
                <button key={account.handle} onClick={() => { navigate(`/twitter/profile/${encodeURIComponent(account.handle)}`); setSearchTerm(''); }} className="flex w-full items-center gap-2.5 text-left hover:bg-white/[0.04]">
                  <XAvtr acct={account} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-white">{account.name}</p>
                    <p className="truncate text-[11px] text-[#71767b]">{account.handle} · {fmtN(account.followers)} abonnés</p>
                  </div>
                </button>
              )) : <p className="px-3 py-3 text-[12px] text-[#71767b]">Aucun compte public trouvé.</p>}
            </div>
          )}
        </div>
        <div className="bg-[#16181c] rounded-2xl overflow-hidden">
          <p className="px-4 pt-4 pb-2 font-bold text-[18px]">Tendances pour vous</p>
          {XTRENDS.map(([tag, count]) => (
            <div key={tag} className="px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer border-t border-[#2f3336]">
              <p className="text-[11px] text-[#71767b]">Caledora · Tendances</p>
              <p className="font-bold text-[14px] mt-0.5">{tag}</p>
              <p className="text-[11px] text-[#71767b]">{count}</p>
            </div>
          ))}
        </div>
        {publicAccounts.length > 0 && (
          <div className="bg-[#16181c] rounded-2xl overflow-hidden">
            <p className="px-4 pt-4 pb-2 font-bold text-[18px]">Suggestions</p>
              {publicAccounts.slice(0, 4).map(acct => (
                <div key={acct.handle} className="flex items-center gap-3 border-t border-[#2f3336] px-4 py-3">
                  <button onClick={() => navigate(`/twitter/profile/${encodeURIComponent(acct.handle)}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-80">
                    <XAvtr acct={acct} size={42}/>
                    <span className="min-w-0"><span className="flex items-center gap-1"><span className="truncate text-[14px] font-bold">{acct.name}</span><XBadgeIcon type={acct.badge}/></span><span className="block truncate text-[11px] text-[#71767b]">{acct.handle}</span></span>
                  </button>
                  <button className="shrink-0 rounded-full bg-white px-4 py-1.5 text-[13px] font-bold text-black transition-colors hover:bg-white/90">Suivre</button>
                </div>
              ))}
          </div>
        )}
        <div className="text-[11px] text-[#71767b] flex flex-wrap gap-x-2 gap-y-1 px-1 pb-4">
          {['Conditions','Confidentialité','Cookies','À propos'].map(l => <span key={l} className="hover:underline cursor-pointer">{l}</span>)}
          <span>© 2026 Caledora Digital Services</span>
        </div>
      </div>

      {imgOpen && <div className="fixed inset-0 z-20" onClick={() => setImgOpen(false)}/>}
    </div>
  );
}

function TwitterPage() {
  const { pages, ready } = usePages();
  if (!ready) return <div className="min-h-screen grid place-items-center bg-black text-sm text-[#71767b]">Chargement de Twitter/X…</div>;
  return <TwitterWorkspace pages={pages} />;
}

function InstagramPage() {
  const { pages, ready } = usePages();
  if (!ready) return <div className="min-h-[50vh] grid place-items-center text-sm text-[var(--wiki-text-muted)]">Chargement d’Instagram…</div>;
  return <InstagramApp pages={pages} />;
}


function Router() {
  return (
    <LightboxProvider>
      <Shell>
        <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/oria" component={OriaBank} />
        <Route path="/instagram" component={InstagramPage} />
        <Route path="/wiki" component={WikiList} />
        <Route path="/twitter/profile/:handle" component={TwitterPage} />
        <Route path="/twitter" component={TwitterPage} />
        <Route path="/sauvegarde" component={GlobalBackupPage} />
        <Route path="/create" component={CreatePage} />
        <Route path="/page/:id/edit" component={EditPage} />
        <Route path="/page/:id/compare" component={ComparePage} />
        <Route path="/page/:id/history" component={HistoryPage} />
        <Route path="/page/:id" component={ReaderPage} />
        <Route path="/trash" component={TrashPage} />
        <Route component={NotFound} />
        </Switch>
      </Shell>
    </LightboxProvider>
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
