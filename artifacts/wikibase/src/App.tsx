import 'flag-icons/css/flag-icons.min.css';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { Archive, ArrowLeft, BarChart2, BookOpen, Check, ChevronRight, Clock3, Download, FileText, GitCompare, Heart, Image as ImageIcon, Menu, MessageCircle, MoreHorizontal, Pencil, Plus, Repeat2, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Star, Trash2, Upload, X } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import { allText, demoSource, formatDate, loadPages, parseWikiText, savePages, type WBBlock, type WBImage, type WBInfoboxSection, type WBJersey, type WBSection, type WikiPage } from '@/lib/wikibase';
import { getUploadedMedia, uploadMedia } from '@workspace/media-upload';
import OriaBank from '@/pages/OriaBank.jsx';
import { TWITTER_ACCOUNTS, TWITTER_ACCOUNT_TEMPLATES, type TwitterAccountCategory } from '@/data/twitterAccounts';
import { InstagramApp } from '@/components/instagram/InstagramApp';

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

      {/* ── Export / sauvegarde ─────────────────────── */}
      <div className="appearance-panel-section">
        <div className="appearance-panel-label">Données</div>
        <ExportButton />
        <p className="text-[11px] text-muted-foreground px-1 pt-0.5">
          Import complet disponible sur le <a href="/" className="wiki-link">tableau de bord</a>.
        </p>
      </div>
    </div>
  );
}

/** Shared export logic — triggers browser download of a JSON backup. */
function triggerExport() {
  return loadPages().then((pages) => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      pages: pages.filter((p) => !p.isTrashed),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wikibase-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return pages.filter((p) => !p.isTrashed).length;
  });
}

/**
 * Full backup bar — export + import side by side.
 * `onImported` receives the fully merged page list (existing + imported).
 */
function BackupBar({ onImported }: { onImported: (pages: WikiPage[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [exportDone, setExportDone] = useState(false);
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);

  function handleExport() {
    triggerExport().then(() => {
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const imported: WikiPage[] = Array.isArray(json) ? json : (json.pages ?? []);
        if (!imported.length) throw new Error('Aucun article trouvé dans le fichier.');
        const existing = await loadPages();
        const byId = new Map(existing.map((p) => [p.id, p]));
        for (const p of imported) byId.set(p.id, p);
        const merged = [...byId.values()];
        onImported(merged);
        setNotice({ msg: `${imported.length} article${imported.length > 1 ? 's' : ''} importé${imported.length > 1 ? 's' : ''} avec succès !`, ok: true });
      } catch (err) {
        setNotice({ msg: `Erreur : ${err instanceof Error ? err.message : 'fichier invalide'}`, ok: false });
      }
      setTimeout(() => setNotice(null), 4000);
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsText(file);
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <button
        onClick={handleExport}
        className="inline-flex items-center gap-1.5 rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-3 py-1.5 text-sm hover:bg-[#eaecf0] dark:hover:bg-muted transition"
      >
        {exportDone ? <Check size={13} className="text-green-600" /> : <Download size={13} />}
        {exportDone ? 'Téléchargé !' : 'Exporter mes articles'}
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded border border-[var(--wiki-border)] dark:border-border bg-white dark:bg-secondary px-3 py-1.5 text-sm hover:bg-[#eaecf0] dark:hover:bg-muted transition"
      >
        <Upload size={13} />
        Importer des articles
      </button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
      {notice && (
        <span className={`text-sm ${notice.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {notice.ok ? <Check size={13} className="inline mr-1" /> : null}
          {notice.msg}
        </span>
      )}
    </div>
  );
}

/** Compact export-only button kept in the Appearance panel. */
function ExportButton() {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => triggerExport().then(() => { setDone(true); setTimeout(() => setDone(false), 2500); })}
      className="appearance-panel-option justify-between text-sm hover:bg-secondary rounded-sm px-1 py-1 w-full text-left transition"
    >
      <span className="flex items-center gap-1.5">
        {done ? <Check size={14} className="text-green-600" /> : <Download size={14} />}
        {done ? 'Téléchargé !' : 'Exporter la sauvegarde'}
      </span>
      <span className="text-[10px] text-muted-foreground">.json</span>
    </button>
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
  const isHome = location === '/' || location === '/twitter' || location === '/oria' || location === '/instagram';

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
  useEffect(() => {
    loadPages().then((p) => { setPagesState(p); setReady(true); });
  }, []);
  const setPages = (next: WikiPage[]) => { setPagesState(next); savePages(next); };
  return { pages, setPages, ready };
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
  const { pages } = usePages();
  const { appearance, setAppearance } = useAppearance();

  const [now, setNow] = useState(new Date());
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

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
  ];

  const handleApp = (app: DashApp) => {
    if (!app.active) { setComingSoon(app.label); return; }
    if (app.id === 'wikibase')  navigate('/wiki');
    if (app.id === 'instagram') navigate('/instagram');
    if (app.id === 'twitter')   navigate('/twitter');
    if (app.id === 'airways')   { window.location.href = '/airways/'; return; }
    if (app.id === 'bank')      { window.location.href = '/oria'; return; }
    if (app.id === 'settings')  setShowSettings(true);
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
  const visible = active.filter(
    (p) => allText(p).includes(query.toLowerCase()) && (filter === 'Toutes' || p.category === filter)
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

      <BackupBar onImported={setPages} />

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

/** Lowercase + strip diacritics for accent-insensitive comparison. */
function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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
  return (
    <aside data-testid="content-infobox" className="wiki-infobox w-full lg:float-right lg:clear-right lg:ml-5 lg:mb-4 lg:w-[280px] lg:shrink-0 mb-4">
      <div className="wiki-infobox-header" style={{ background: accentColor, color: headerTextColor }}>{page.title}</div>

      {/* Optional image */}
      {page.infoboxImage && (
        <div className="flex items-center justify-center border-b border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-muted py-2 text-center text-xs text-muted-foreground overflow-hidden" style={{ minHeight: 140 }}>
          {resolveImageSrc(page.infoboxImage)
            ? <img
                src={resolveImageSrc(page.infoboxImage)}
                alt={page.infoboxImage.alt}
                className="max-h-40 max-w-full object-contain cursor-zoom-in"
                onClick={() => {
                  const src = resolveImageSrc(page.infoboxImage!);
                  if (src) openLightbox({ src, alt: page.infoboxImage!.alt, caption: page.infoboxImage!.caption });
                }}
                onError={(e) => {
                  console.error('[WikiBase] Image introuvable :', e.currentTarget.src);
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.removeAttribute('hidden');
                }}
              />
            : null
          }
          {/* Placeholder shown when img fails or no src */}
          <span hidden={!!resolveImageSrc(page.infoboxImage)}>
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

  const pickFile = async (file?: File) => {
    if (!file) return;
    setUploading(true); setUploadError('');
    try {
      const uploaded = await uploadMedia(file, 'wikibase');
      onChange({ ...image, filename: uploaded.path, src: uploaded.path, missing: false });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Import impossible.');
    } finally {
      setUploading(false);
    }
  };
  const set = (key: keyof WBImage, value: string) => onChange({ ...image, [key]: value });

  return (
    <div className="rounded border border-[var(--wiki-border)] dark:border-border bg-[#f8f9fa] dark:bg-secondary p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2"><ImageIcon size={14} className="text-primary" /><span className="text-sm font-bold truncate">{label}</span></div>
        <button data-testid={`button-delete-image-${label}`} onClick={onDelete} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
      </div>

      {/* Live preview */}
      <div className="mb-2 flex h-24 items-center justify-center rounded border border-[var(--wiki-border)] dark:border-border bg-[#eaecf0] dark:bg-muted overflow-hidden text-xs text-muted-foreground">
        {previewSrc
          ? <img
              src={previewSrc}
              alt={image.alt || label}
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                console.error('[WikiBase] Aperçu image introuvable :', e.currentTarget.src);
                e.currentTarget.style.display = 'none';
              }}
            />
          : <span className="flex flex-col items-center gap-1 text-center px-3"><ImageIcon size={18} className="opacity-40" />Aucune image</span>
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

      <label className={`mt-2 flex cursor-pointer items-center justify-center rounded border border-dashed border-primary/40 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/5 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
        <Upload size={12} className="mr-1" /> {uploading ? 'Import en cours…' : 'Importer depuis mon ordinateur'}
        <input data-testid={`input-replace-image-${label}`} type="file" accept=".jpg,.jpeg,.png,.webp,.svg,image/*" className="hidden" disabled={uploading} onChange={(e) => { void pickFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
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

function EditPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { pages, setPages, ready } = usePages();
  const original = pages.find((p) => p.id === id) ?? pages[0];
  const [page, setPage] = useState<WikiPage | null>(null);

  useEffect(() => {
    if (ready && original && !page) setPage(structuredClone(original));
  }, [ready, original?.id]);

  const update = (key: keyof WikiPage, value: unknown) => setPage((p) => p ? { ...p, [key]: value } : p);
  const save = () => {
    if (!page) return;
    const next = pages.map((p) => p.id === page.id
      ? { ...page, updatedAt: new Date().toISOString(), history: [...p.history, { timestamp: new Date().toISOString(), label: 'Modification visuelle', sourceText: page.sourceText }] }
      : p
    );
    setPages(next); setLocation(`/page/${page.id}`);
  };

  if (!ready || !page) return <div className="animate-rise p-6 text-sm text-muted-foreground">Chargement…</div>;
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
  country?: string;
  isSystem?: boolean;
};
type XReply   = { id: string; acct: XAccount; text: string; likes: number; ts: number; editedAt?: number };
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
};

const xColor  = (s: string) => { let h = 0; for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0; return `hsl(${((h >>> 0) % 360)},60%,42%)`; };
const xHandle = (t: string) => '@' + t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
const xInits  = (n: string) => { const p = n.trim().split(/\s+/); return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : n.slice(0, 2)).toUpperCase(); };
const xBadge  = (cat: string): 'gold' | 'blue' | null => ['Sports & Football','Économie','Transports','Géographie','Monuments & Lieux'].includes(cat) ? 'gold' : ['Personnes & Organisations','Politique'].includes(cat) ? 'blue' : 'gold';
const fmtN    = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
const xAgo    = (ts: number) => { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return `${s}s`; const m = Math.floor(s / 60); if (m < 60) return `${m}min`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };

function wikiToXAcct(p: WikiPage): XAccount {
  let avatarUrl: string | undefined;
  if (p.infoboxImage) { const f = (p.infoboxImage.src || p.infoboxImage.filename).trim(); if (f) avatarUrl = /^(https?:\/\/|data:)/.test(f) ? f : import.meta.env.BASE_URL + f.replace(/^\/+/, ''); }
  return {
    handle: xHandle(p.title),
    name: p.title,
    avatarUrl,
    initials: xInits(p.title),
    avatarColor: xColor(p.title),
    badge: xBadge(p.category),
    category: 'WIKI_OFFICIAL',
  };
}

const XMEDIA: XAccount[] = [
  { handle: '@CaledoraSport', name: 'Caledora Sport',   initials: 'CS', avatarColor: '#1d9bf0', badge: 'blue', category: 'WIKI_OFFICIAL', isSystem: true },
  { handle: '@MediaCaledora', name: 'Médias Caledora',  initials: 'MC', avatarColor: '#7856ff', badge: 'blue', category: 'WIKI_OFFICIAL', isSystem: true },
  { handle: '@InsiderCaled',  name: 'Caledora Insider', initials: 'CI', avatarColor: '#00ba7c', badge: null,   category: 'WIKI_OFFICIAL', isSystem: true },
  { handle: '@CFCFan07',      name: 'Fan CFC 🏟️',       initials: 'FC', avatarColor: '#ff7a00', badge: null,   category: 'WIKI_OFFICIAL', isSystem: true },
];

const XREGISTRY: XAccount[] = TWITTER_ACCOUNTS.map(acct => ({
  ...acct,
  initials: xInits(acct.name),
  avatarColor: xColor(acct.name),
}));

const XTRENDS = [['#CFCvARS','42,1K tweets'],['#Caledora','18,7K tweets'],['#CaledoraSport','9,4K tweets'],['#OriaBankOpen','6,2K tweets'],['#CALNED','4,8K tweets']] as const;

const xReplyTpl = (name: string) => [
  `🔥 ${name} continue de marquer les esprits ! La communauté de Caledora est avec vous 💙 #Caledora`,
  `On en parle ce soir sur @CaledoraSport ! Merci ${name} pour cette mise à jour 📺`,
  `Notre analyse arrive bientôt sur @MediaCaledora — restez connectés 📰`,
  `Quelle nouvelle ! ${name} fait avancer les choses dans la République 💪 #CaledoraCity`,
  `Bravo ! Les fans attendaient ça depuis longtemps 🎉 #Caledora`,
  `⚡ Le dynamisme de Caledora ne s'arrête jamais ! #CaledoraSport`,
];

type XTopic = 'MERCATO' | 'ANALYSIS' | 'FINANCE' | 'CULTURE' | 'BUSINESS';

function classifyTweetTopic(text: string): XTopic {
  const value = text.toLowerCase();
  if (/(transfert|mercato|recrue|signature|contrat|here we go|prêt|loan|deadline)/.test(value)) return 'MERCATO';
  if (/(tactique|analyse|data|stat|xg|pressing|système|formation|scout)/.test(value)) return 'ANALYSIS';
  if (/(finance|budget|économie|géopolitique|investissement|dette|valorisation|salaire)/.test(value)) return 'FINANCE';
  if (/(cinéma|film|série|culture|musique|festival|acteur)/.test(value)) return 'CULTURE';
  return 'BUSINESS';
}

function contextCategories(topic: XTopic): TwitterAccountCategory[] {
  if (topic === 'MERCATO') return ['MERCATO_GLOBAL', 'FRANCE_INSIDERS_MEDIAS', 'UK_INSIDERS_MEDIAS', 'SPAIN_INSIDERS_MEDIAS', 'ITALY_INSIDERS_MEDIAS', 'GERMANY_INSIDERS_MEDIAS'];
  if (topic === 'ANALYSIS' || topic === 'FINANCE') return ['DATA_TACTICS_INVESTIGATION'];
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
  { id:'xi1', ts:Date.now()-1000*60*35,  likes:847, retweets:234, views:12400, liked:false, retweeted:false, replies:[], acct:{ handle:'@CaledoraFC',      name:'Caledora FC',       initials:'CF', avatarColor:xColor('Caledora FC'),       avatarUrl:`${import.meta.env.BASE_URL}images/logo1.png`,    badge:'gold', category:'WIKI_OFFICIAL' }, text:'⚽ Matchday ! Caledora FC reçoit Arsenal ce samedi à 20h45 au Caledora Mare Stadium. Soyez nombreux dans les tribunes ! 💙🏟️ #CFCvARS #Caledora' },
  { id:'xi2', ts:Date.now()-1000*60*90,  likes:312, retweets:89,  views:5800,  liked:false, retweeted:false, replies:[], acct:{ handle:'@OriaBank',         name:'Oria Bank',         initials:'OB', avatarColor:xColor('Oria Bank'),         avatarUrl:`${import.meta.env.BASE_URL}images/oriabank.png`, badge:'gold', category:'WIKI_OFFICIAL' }, text:'🏦 Oria Bank est fière d\'annoncer l\'ouverture de sa 12e agence à Caledora City ! Rendez-vous lundi pour l\'inauguration. #OriaBankOpen' },
  { id:'xi3', ts:Date.now()-1000*60*180, likes:521, retweets:173, views:9100,  liked:false, retweeted:false, replies:[], acct:{ handle:'@CaledoraAirways', name:'Caledora Airways',  initials:'CA', avatarColor:xColor('Caledora Airways'), avatarUrl:`${import.meta.env.BASE_URL}images/airways2.jpg`,badge:'gold', category:'WIKI_OFFICIAL' }, text:'✈️ Nouvelle liaison directe Caledora City → Paris CDG dès le 1er septembre ! Réservez vos billets en avant-première. Bon vol à tous 🌍' },
];

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

type XEditTarget = { tweetId: string; replyId?: string } | null;

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
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
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
  onEditDraftChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const showThread = expanded && tweet.replies.length > 0;
  const editingTweet = editing?.tweetId === tweet.id && !editing.replyId;
  return (
    <div style={{ borderBottom: '1px solid #2f3336' }}>
      {/* ── Main tweet ── */}
      <div className="flex gap-3 px-4 pt-3 pb-2 hover:bg-white/[0.025] transition-colors">
        {/* Avatar + vertical thread line below */}
        <div className="flex flex-col items-center shrink-0" style={{ width: 44 }}>
          <XAvtr acct={tweet.acct} size={44} />
          {showThread && <div className="w-0.5 flex-1 bg-[#2f3336] mt-1.5 min-h-[14px]" />}
        </div>
        <div className="flex-1 min-w-0 pb-1">
          <div className="flex items-start gap-1.5 mb-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 flex-wrap leading-none">
              <span className="font-bold text-[15px] text-white">{tweet.acct.name}</span>
              <XBadgeIcon type={tweet.acct.badge} />
              <span className="text-[#71767b] text-[13px]">{tweet.acct.handle} · {xAgo(tweet.ts)}{tweet.editedAt ? ` · Modifié · ${new Date(tweet.editedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
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
              <MessageCircle size={16} /><span>{tweet.replies.length || ''}</span>
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
                : <><Sparkles size={13} /><span className="hidden sm:inline ml-0.5">Simuler</span></>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Replies thread ── */}
      {showThread && (
        <div>
          {tweet.replies.map((r, i) => {
            const isLast = i === tweet.replies.length - 1;
            return (
              <div key={r.id} className="flex gap-2 px-4 pt-2 pb-1.5 hover:bg-white/[0.02] transition-colors">
                {/* Avatar column with thread lines */}
                <div className="flex flex-col items-center shrink-0" style={{ width: 44 }}>
                  <div className="w-0.5 h-2 bg-[#2f3336]" />
                  <XAvtr acct={r.acct} size={32} />
                  {!isLast && <div className="w-0.5 flex-1 bg-[#2f3336] mt-1.5 min-h-[8px]" />}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-start gap-1.5 mb-1">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] flex-wrap leading-none">
                      <span className="font-bold text-white">{r.acct.name}</span>
                      <XBadgeIcon type={r.acct.badge} />
                      <span className="text-[#71767b]">{r.acct.handle} · {xAgo(r.ts)}{r.editedAt ? ` · Modifié · ${new Date(r.editedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
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
                    <span className="flex items-center gap-1 ml-auto"><BarChart2 size={11} /><span>{fmtN(Math.floor(r.likes * 8 + Math.random() * 200))}</span></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TwitterPage() {
  const [, navigate] = useLocation();
  const { pages } = usePages();

  const wikiAccts = useMemo(() => pages.filter(p => !p.isTrashed).map(wikiToXAcct), [pages]);
  const dynamicFanAccts = useMemo(() => wikiAccts.slice(0, 3).flatMap(acct =>
    TWITTER_ACCOUNT_TEMPLATES.CLUB_ACTU.slice(0, 2).map(suffix => ({
      handle: `${acct.handle}${suffix}`.replace(/[^@a-zA-Z0-9_]/g, ''),
      name: `${acct.name} ${suffix}`,
      initials: xInits(acct.name),
      avatarColor: xColor(`${acct.name}${suffix}`),
      badge: null,
      category: 'WIKI_OFFICIAL' as const,
      isSystem: true,
    })),
  ), [wikiAccts]);
  const allAccts  = useMemo(() => uniqueXAccounts([...wikiAccts, ...XMEDIA, ...XREGISTRY, ...dynamicFanAccts]), [wikiAccts, dynamicFanAccts]);

  const [tweets, setTweetsState] = useState<XTweet[]>(() => {
    try { const s = localStorage.getItem(XSTORAGE); if (s) return JSON.parse(s); } catch {}
    return XINIT;
  });
  const setTweets = (t: XTweet[]) => { setTweetsState(t); localStorage.setItem(XSTORAGE, JSON.stringify(t)); };

  const [tab, setTab]           = useState<'foryou' | 'following'>('foryou');
  const [draft, setDraft]       = useState('');
  const [authorIdx, setAuthorIdx] = useState(0);
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

  const author    = allAccts[authorIdx] ?? XINIT[0].acct;
  const displayed = tab === 'foryou' ? tweets : tweets.filter(t => !t.acct.isSystem);

  // Fetches AI-generated replies from the backend and maps them to XReply[]
  const fetchAIReplies = async (
    tweetText: string,
    tweetAuthor: XAccount,
    existingReplies: XReply[],
  ): Promise<XReply[]> => {
    const mentions = extractMentions(tweetText);
    const alreadyReplied = new Set(existingReplies.map(r => r.acct.handle.toLowerCase()));
    const topic = classifyTweetTopic(tweetText);
    const knownMentions = mentions
      .map(handle => allAccts.find(acct => acct.handle.toLowerCase() === handle.toLowerCase()))
      .filter((acct): acct is XAccount => Boolean(acct))
      .filter(acct => acct.handle.toLowerCase() !== tweetAuthor.handle.toLowerCase())
      .filter(acct => !alreadyReplied.has(acct.handle.toLowerCase()));
    const targetReplyCount = Math.max(2, Math.min(4, knownMentions.length + 2));
    const contextualAccounts = allAccts
      .filter(acct => contextCategories(topic).includes(acct.category))
      .filter(acct => acct.handle.toLowerCase() !== tweetAuthor.handle.toLowerCase())
      .filter(acct => !alreadyReplied.has(acct.handle.toLowerCase()));
    const candidates = uniqueXAccounts([...knownMentions, ...contextualAccounts]).slice(0, 70);
    const makeReply = (acct: XAccount, content: string, id: string): XReply => ({
      id,
      acct,
      text: content,
      likes: Math.floor(Math.random() * 120) + 2,
      ts: Date.now() - Math.floor(Math.random() * 180000),
    });
    const buildFallback = (limit = targetReplyCount) => {
      const required = knownMentions.map((acct, index) =>
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
          topic,
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
      const mentionReplies = knownMentions.map((acct, index) => {
        const generated = returned.get(acct.handle.toLowerCase());
        return makeReply(acct, generated?.content?.trim() || genMentionReply(acct, tweetText, tweetAuthor), `xr_ai_mention_${Date.now()}_${index}`);
      });
      const used = new Set([tweetAuthor.handle.toLowerCase(), ...alreadyReplied, ...mentionReplies.map(reply => reply.acct.handle.toLowerCase())]);
      const regularReplies = [...returned.values()]
        .map(reply => ({ reply, acct: candidates.find(acct => acct.handle.toLowerCase() === reply.handle.toLowerCase()) }))
        .filter((value): value is { reply: { handle: string; name: string; content: string }; acct: XAccount } => Boolean(value.acct))
        .filter(value => !used.has(value.acct.handle.toLowerCase()))
        .slice(0, Math.max(0, targetReplyCount - mentionReplies.length))
        .map((value, index) => makeReply(value.acct, value.reply.content.trim(), `xr_ai_context_${Date.now()}_${index}`));
      const resolved = [...mentionReplies, ...regularReplies];
      return resolved.length >= Math.min(2, Math.max(1, knownMentions.length)) ? resolved : buildFallback();
    } catch {
      return buildFallback();
    }
  };

  const postTweet = async () => {
    if (!draft.trim() || aiPosting) return;
    const text = draft.trim();
    const imageUrl = imgUrl.trim() || undefined;
    const tweetId = `xt_${Date.now()}`;
    const t: XTweet = { id: tweetId, acct: author, text, imageUrl, ts: Date.now(), likes: 0, retweets: 0, views: Math.floor(Math.random() * 50) + 1, liked: false, retweeted: false, replies: [] };
    setTweets([t, ...tweets]);
    setDraft(''); setImgUrl('');
    setAiPosting(true);
    const aiReplies = await fetchAIReplies(text, author, []);
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

  const toggleLike = (id: string) => setTweets(tweets.map(t => t.id === id ? { ...t, liked: !t.liked, likes: t.liked ? t.likes - 1 : t.likes + 1 } : t));
  const toggleRT   = (id: string) => setTweets(tweets.map(t => t.id === id ? { ...t, retweeted: !t.retweeted, retweets: t.retweeted ? t.retweets - 1 : t.retweets + 1 } : t));

  const beginEdit = (tweetId: string, reply?: XReply) => {
    const tweet = tweets.find(item => item.id === tweetId);
    if (!tweet) return;
    setMenuId(null);
    setEditing({ tweetId, ...(reply ? { replyId: reply.id } : {}) });
    setEditDraft(reply?.text ?? tweet.text);
  };
  const cancelEdit = () => { setEditing(null); setEditDraft(''); };
  const saveEdit = () => {
    if (!editing || !editDraft.trim()) return;
    const updated = tweets.map(tweet => {
      if (tweet.id !== editing.tweetId) return tweet;
      if (!editing.replyId) return { ...tweet, text: editDraft.trim(), editedAt: Date.now() };
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
    const aiReplies = await fetchAIReplies(tw.text, tw.acct, tw.replies);
    setAiLoading(prev => { const s = new Set(prev); s.delete(id); return s; });
    if (aiReplies.length > 0) {
      setTweetsState(prev => {
        const updated = prev.map(t => t.id === id ? { ...t, replies: [...t.replies, ...aiReplies] } : t);
        localStorage.setItem(XSTORAGE, JSON.stringify(updated));
        return updated;
      });
    }
  };

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
          <button key={item.l} className="flex items-center gap-4 px-3 py-3.5 rounded-full hover:bg-white/10 transition-colors text-left w-full" style={{ color: item.a ? '#fff' : '#e7e9ea' }}>
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
            {(['foryou','following'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className="flex-1 py-3 text-[14px] font-medium hover:bg-white/5 transition-colors relative" style={{ color: tab === t ? '#fff' : '#71767b' }}>
                {t === 'foryou' ? 'Pour vous' : 'Abonnements'}
                {tab === t && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-16 rounded-full bg-[#1d9bf0]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="px-4 pt-4 pb-3 border-b border-[#2f3336]">
          <div className="flex gap-3">
            <XAvtr acct={author} size={44} />
            <div className="flex-1 min-w-0">
              {allAccts.length > 0 && (
                <select value={authorIdx} onChange={e => setAuthorIdx(Number(e.target.value))} style={{ background: '#000' }}
                  className="mb-2 text-[12px] border border-[#2f3336] rounded-full px-3 py-1 text-[#1d9bf0] cursor-pointer outline-none hover:bg-white/5 max-w-full">
                  {allAccts.map((a, i) => <option key={a.handle} value={i} style={{ background: '#111' }}>{a.name} {a.handle}</option>)}
                </select>
              )}
              <textarea id="x-compose-area" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postTweet(); }}
                placeholder="Quoi de neuf ?" rows={draft.length > 80 ? 3 : 2}
                className="w-full bg-transparent text-[18px] placeholder-[#71767b] outline-none resize-none leading-relaxed" />
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
              onEditDraftChange={setEditDraft}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
            />
          ))}
        </div>
      </div>

      {/* ── RIGHT SIDEBAR ────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[340px] h-full px-4 py-4 overflow-y-auto shrink-0 gap-4">
        <div className="flex items-center gap-3 bg-[#202327] rounded-full px-4 py-2.5">
          <Search size={15} className="text-[#71767b] shrink-0"/>
          <input type="text" placeholder="Rechercher sur X" className="bg-transparent text-sm outline-none flex-1 placeholder-[#71767b] text-white"/>
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
        {wikiAccts.length > 0 && (
          <div className="bg-[#16181c] rounded-2xl overflow-hidden">
            <p className="px-4 pt-4 pb-2 font-bold text-[18px]">Suggestions</p>
            {wikiAccts.slice(0, 4).map(acct => (
              <div key={acct.handle} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] border-t border-[#2f3336] transition-colors">
                <XAvtr acct={acct} size={42}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1"><span className="font-bold text-[14px] truncate">{acct.name}</span><XBadgeIcon type={acct.badge}/></div>
                  <p className="text-[11px] text-[#71767b] truncate">{acct.handle}</p>
                </div>
                <button className="bg-white text-black font-bold text-[13px] px-4 py-1.5 rounded-full hover:bg-white/90 shrink-0 transition-colors">Suivre</button>
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
        <Route path="/twitter" component={TwitterPage} />
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
