import type { WikiPage } from '@/lib/wikibase';
import { instagramMediaObjectUrl } from './instagramMediaStorage';

export type InstagramAccountType =
  | 'athlète / joueur' | 'club sportif' | 'entreprise / marque'
  | 'institution / ville' | 'artiste / personnalité' | 'média / presse'
  | 'personnel / proche';
export type InstagramRelationType = 'coéquipier' | 'club lié' | 'rival' | 'conjoint(e)' | 'ami proche' | 'coach' | 'famille' | 'sponsor' | 'partenaire';
export type InstagramReputation = 'leader' | 'discret' | 'controversé' | 'populaire';
export type InstagramPersonality = 'familier' | 'corpo' | 'provocateur' | 'modeste';
export type InstagramCommunicationTone = 'institutionnel' | 'proche des fans' | 'luxe / prestige' | 'agressif / piquant';
export type InstagramStatus = 'historique' | 'incontournable' | 'populaire' | 'disruptif';
export type InstagramTone = 'célébration' | 'défaite' | 'clash' | 'romance' | 'officiel';
export type InstagramRatio = 'square' | 'portrait' | 'landscape';

export type InstagramProfile = {
  id: string;
  wikiPageId?: string;
  username: string;
  displayName: string;
  verified: boolean;
  accountType: InstagramAccountType;
  category: string;
  bio: string;
  link?: string;
  avatar: string;
  reputation: InstagramReputation;
  personality: InstagramPersonality;
  communicationTone: InstagramCommunicationTone;
  status: InstagramStatus;
  followers: number;
  following: number;
  followingByViewer?: boolean;
  relations: Array<{ profileId: string; type: InstagramRelationType }>;
};

export type InstagramComment = {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
  likes: number;
};

export type InstagramPost = {
  id: string;
  authorId: string;
  media: string[];
  ratio: InstagramRatio;
  caption: string;
  location?: string;
  createdAt: number;
  likes: number;
  commentCount?: number;
  likedByViewer?: boolean;
  savedByViewer?: boolean;
  tags?: string[];
  comments: InstagramComment[];
};

export type InstagramStory = {
  id: string;
  authorId: string;
  media: string;
  text?: string;
  active: boolean;
  createdAt: number;
};

export type InstagramHighlight = {
  id: string;
  profileId: string;
  title: string;
  cover: string;
  storyIds: string[];
};

export type InstagramDatabase = {
  version: 1;
  profiles: InstagramProfile[];
  posts: InstagramPost[];
  stories: InstagramStory[];
  highlights: InstagramHighlight[];
};

const STORAGE_KEY = 'caledora-instagram-v1';
export const instagramAccountTypes: InstagramAccountType[] = ['athlète / joueur', 'club sportif', 'entreprise / marque', 'institution / ville', 'artiste / personnalité', 'média / presse', 'personnel / proche'];
export const instagramRelationTypes: InstagramRelationType[] = ['coéquipier', 'club lié', 'rival', 'conjoint(e)', 'ami proche', 'coach', 'famille', 'sponsor', 'partenaire'];
export const instagramReputations: InstagramReputation[] = ['leader', 'discret', 'controversé', 'populaire'];
export const instagramPersonalities: InstagramPersonality[] = ['familier', 'corpo', 'provocateur', 'modeste'];
export const instagramCommunicationTones: InstagramCommunicationTone[] = ['institutionnel', 'proche des fans', 'luxe / prestige', 'agressif / piquant'];
export const instagramStatuses: InstagramStatus[] = ['historique', 'incontournable', 'populaire', 'disruptif'];
const ratios: InstagramRatio[] = ['square', 'portrait', 'landscape'];
const legacyMedia: Record<string, string> = { 'Instagram.png': 'brand.svg', 'rivages.jpg': 'caledora-street.svg', 'airways.jpg': 'stadium-night.svg', 'airways2.jpg': 'stadium-night.svg', 'site_logo.png': 'profile.svg' };
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const safeId = (value: unknown) => text(value, 100).replace(/[^a-zA-Z0-9._-]/g, '');
const uploadedMediaPath = /^\/api\/images\/(?:shared|instagram|wikibase|twitter|airways)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,110}\.(?:svg|png|jpe?g|webp)$/i;
const indexedDbMediaId = /^upload:[a-zA-Z0-9-]{1,80}$/;
const safeMedia = (value: unknown, fallback = 'profile.svg') => {
  const file = text(value, 180);
  if (uploadedMediaPath.test(file) || indexedDbMediaId.test(file)) return file;
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}\.(?:svg|png|jpe?g|webp)$/i.test(file) ? file : legacyMedia[file] ?? fallback;
};
const safeNumber = (value: unknown, fallback = 0, max = 9_999_999) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(Number(value)))) : fallback;
const safeLink = (value: unknown) => {
  const url = text(value, 220);
  return /^https?:\/\/[^\s]+$/i.test(url) ? url : undefined;
};

const legacyAccountTypes: Record<string, InstagramAccountType> = {
  joueur: 'athlète / joueur', joueuse: 'athlète / joueur', coach: 'athlète / joueur', président: 'athlète / joueur',
  club: 'club sportif', 'personnalité publique': 'artiste / personnalité', 'femme/compagne': 'personnel / proche', média: 'média / presse',
};
const normaliseAccountType = (value: unknown): InstagramAccountType => {
  const item = text(value, 60).toLowerCase();
  return instagramAccountTypes.includes(item as InstagramAccountType) ? item as InstagramAccountType : legacyAccountTypes[item] ?? 'artiste / personnalité';
};
const normaliseReputation = (value: unknown): InstagramReputation => {
  const item = text(value, 30).toLowerCase();
  if (item === 'arrogant' || item === 'clash') return 'controversé';
  return instagramReputations.includes(item as InstagramReputation) ? item as InstagramReputation : 'populaire';
};
const normalisePersonality = (value: unknown): InstagramPersonality => {
  const item = text(value, 30).toLowerCase();
  if (item === 'timide') return 'modeste';
  return instagramPersonalities.includes(item as InstagramPersonality) ? item as InstagramPersonality : 'familier';
};
const normaliseRelationType = (value: unknown): InstagramRelationType | null => {
  const item = text(value, 40).toLowerCase();
  const mapped = item === 'couple' ? 'conjoint(e)' : item;
  return instagramRelationTypes.includes(mapped as InstagramRelationType) ? mapped as InstagramRelationType : null;
};

export function usernameFrom(value: string) {
  const plain = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '');
  return plain.slice(0, 26) || 'caledorien';
}

function kindFrom(page: WikiPage): InstagramAccountType {
  const context = `${page.type} ${page.category} ${page.categories.join(' ')}`.toLowerCase();
  if (/(club|football|sport)/.test(context)) return 'club sportif';
  if (/(média|media|journal|presse)/.test(context)) return 'média / presse';
  if (/(ville|institution|ministère|mairie)/.test(context)) return 'institution / ville';
  if (/(entreprise|marque|bank|banque)/.test(context)) return 'entreprise / marque';
  if (/(femme|compagne|famille)/.test(context)) return 'personnel / proche';
  if (/(joueur|joueuse|coach|entra[iî]neur|président|president|dirigeant)/.test(context)) return 'athlète / joueur';
  return 'artiste / personnalité';
}

function profileFromPage(page: WikiPage): InstagramProfile {
  const title = page.title || 'Compte Caledora';
  const type = kindFrom(page);
  const avatar = 'profile.svg';
  return {
    id: `wiki-${page.id}`,
    wikiPageId: page.id,
    username: usernameFrom(title),
    displayName: title,
    verified: type === 'club sportif' || type === 'média / presse' || type === 'institution / ville',
    accountType: type,
    category: page.category || 'Caledora',
    bio: page.subtitle || `Compte officiel de ${title} · Caledora`,
    link: undefined,
    avatar,
    reputation: type === 'club sportif' ? 'leader' : 'populaire',
    personality: type === 'club sportif' ? 'corpo' : 'familier',
    communicationTone: type === 'club sportif' ? 'proche des fans' : 'institutionnel',
    status: type === 'club sportif' ? 'incontournable' : 'populaire',
    followers: 1200 + title.length * 142,
    following: 64 + title.length * 3,
    relations: [],
  };
}

function seedDatabase(pages: WikiPage[]): InstagramDatabase {
  const profiles = pages.filter(page => !page.isTrashed).map(profileFromPage);
  const official: InstagramProfile = {
    id: 'caledora-official',
    username: 'caledora',
    displayName: 'Caledora',
    verified: true,
    accountType: 'média / presse',
    category: 'Média · Caledora',
    bio: 'Le quotidien du football et de la culture à Caledora.',
    avatar: 'brand.svg',
    reputation: 'leader',
    personality: 'corpo',
    communicationTone: 'institutionnel',
    status: 'incontournable',
    followers: 248000,
    following: 438,
    relations: [],
  };
  const communityProfiles: InstagramProfile[] = [
    { id: 'community-tribune', username: 'tribunecaledora', displayName: 'Tribune Caledora', verified: false, accountType: 'média / presse', category: 'Supporters · Caledora', bio: 'Le regard des tribunes sur chaque moment fort.', avatar: 'profile.svg', reputation: 'populaire', personality: 'familier', communicationTone: 'proche des fans', status: 'populaire', followers: 18200, following: 316, relations: [] },
    { id: 'community-era', username: 'caledoraera', displayName: 'Caledora Era', verified: false, accountType: 'personnel / proche', category: 'Communauté', bio: 'Fan account. Pour les grands soirs et les petites victoires.', avatar: 'profile.svg', reputation: 'populaire', personality: 'provocateur', communicationTone: 'proche des fans', status: 'disruptif', followers: 9400, following: 780, relations: [] },
    { id: 'community-zone', username: 'caledorazone', displayName: 'Caledora Zone', verified: false, accountType: 'média / presse', category: 'Actualités sportives', bio: 'Infos, terrain et coulisses du football caledorien.', avatar: 'profile.svg', reputation: 'populaire', personality: 'corpo', communicationTone: 'institutionnel', status: 'populaire', followers: 53600, following: 224, relations: [] },
    { id: 'community-stadium', username: 'stadecaledora', displayName: 'Stade Caledora', verified: false, accountType: 'personnel / proche', category: 'Supporters · Football', bio: 'Les soirs de match vus depuis les tribunes.', avatar: 'profile.svg', reputation: 'populaire', personality: 'familier', communicationTone: 'proche des fans', status: 'populaire', followers: 22100, following: 331, relations: [] },
    { id: 'community-culture', username: 'caledoraculture', displayName: 'Caledora Culture', verified: false, accountType: 'artiste / personnalité', category: 'Culture · Ville', bio: 'La ville, ses visages et ses rendez-vous.', avatar: 'profile.svg', reputation: 'discret', personality: 'modeste', communicationTone: 'luxe / prestige', status: 'historique', followers: 12700, following: 418, relations: [] },
    { id: 'community-vibes', username: 'caledoravibes', displayName: 'Caledora Vibes', verified: false, accountType: 'artiste / personnalité', category: 'Culture · Communauté', bio: 'Les instants simples qui font la ville.', avatar: 'profile.svg', reputation: 'populaire', personality: 'familier', communicationTone: 'proche des fans', status: 'disruptif', followers: 8600, following: 612, relations: [] },
    { id: 'community-circle', username: 'cerclecaledora', displayName: 'Cercle Caledora', verified: false, accountType: 'personnel / proche', category: 'Communauté', bio: 'Des proches, des souvenirs et de belles énergies.', avatar: 'profile.svg', reputation: 'discret', personality: 'modeste', communicationTone: 'proche des fans', status: 'populaire', followers: 6300, following: 507, relations: [] },
  ];
  const allProfiles = [official, ...communityProfiles, ...profiles];
  const firstProfile = profiles[0] ?? official;
  return {
    version: 1,
    profiles: allProfiles,
    posts: [
      {
        id: 'ig-seed-welcome',
        authorId: official.id,
        media: ['stadium-night.svg'],
        ratio: 'landscape',
        caption: 'Bienvenue dans l’univers Caledora. Ici, chaque histoire compte. ✦ #Caledora',
        location: 'Caledora City',
        createdAt: Date.now() - 1000 * 60 * 95,
        likes: 1842,
        commentCount: 96,
        comments: [],
      },
      {
        id: 'ig-seed-wiki',
        authorId: firstProfile.id,
        media: [firstProfile.avatar || 'profile.svg'],
        ratio: 'square',
        caption: `Ravi de vous retrouver ici. Suivez l’actualité de @caledora et les histoires de notre univers.`,
        createdAt: Date.now() - 1000 * 60 * 60 * 4,
        likes: 386,
        commentCount: 24,
        comments: [],
      },
    ],
    stories: [
      { id: 'ig-story-caledora', authorId: official.id, media: 'caledora-street.svg', text: 'La ville ne dort jamais.', active: true, createdAt: Date.now() - 1000 * 60 * 22 },
    ],
    highlights: [
      { id: 'ig-highlight-caledora', profileId: official.id, title: 'Caledora', cover: 'caledora-street.svg', storyIds: ['ig-story-caledora'] },
    ],
  };
}

function isDb(value: unknown): value is InstagramDatabase {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<InstagramDatabase>;
  return item.version === 1 && Array.isArray(item.profiles) && Array.isArray(item.posts)
    && Array.isArray(item.stories) && Array.isArray(item.highlights);
}

function normaliseInstagramDatabase(value: unknown, pages: WikiPage[]): InstagramDatabase | null {
  if (!isDb(value)) return null;
  const profileIds = new Set<string>();
  const profiles: InstagramProfile[] = [];
  for (const raw of value.profiles.slice(0, 300)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = safeId(item.id);
    const username = usernameFrom(text(item.username, 60));
    const displayName = text(item.displayName, 100);
    if (!id || !displayName || profileIds.has(id)) continue;
    profileIds.add(id);
    profiles.push({
      id,
      wikiPageId: safeId(item.wikiPageId) || undefined,
      username,
      displayName,
      verified: item.verified === true,
      accountType: normaliseAccountType(item.accountType),
      category: text(item.category, 80) || 'Caledora',
      bio: text(item.bio, 500),
      link: safeLink(item.link),
      avatar: safeMedia(item.avatar),
      reputation: normaliseReputation(item.reputation),
      personality: normalisePersonality(item.personality),
      communicationTone: instagramCommunicationTones.includes(item.communicationTone as InstagramCommunicationTone) ? item.communicationTone as InstagramCommunicationTone : 'institutionnel',
      status: instagramStatuses.includes(item.status as InstagramStatus) ? item.status as InstagramStatus : 'populaire',
      followers: safeNumber(item.followers, 0),
      following: safeNumber(item.following, 0),
      followingByViewer: item.followingByViewer === true,
      relations: [],
    });
  }
  const requiredProfiles = seedDatabase([]).profiles.filter(profile => profile.id === 'caledora-official' || profile.id.startsWith('community-'));
  for (const profile of requiredProfiles.reverse()) {
    if (!profiles.some(item => item.id === profile.id)) profiles.unshift(profile);
  }
  const finalIds = new Set(profiles.map(profile => profile.id));
  for (const raw of value.profiles) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const profile = profiles.find(candidate => candidate.id === safeId(item.id));
    if (!profile || !Array.isArray(item.relations)) continue;
    const used = new Set<string>();
    profile.relations = item.relations.flatMap(relation => {
      if (!relation || typeof relation !== 'object') return [];
      const value = relation as Record<string, unknown>;
      const profileId = safeId(value.profileId);
      const type = normaliseRelationType(value.type);
      if (!profileId || profileId === profile.id || !finalIds.has(profileId) || used.has(profileId) || !type) return [];
      used.add(profileId);
      return [{ profileId, type }];
    }).slice(0, 60);
  }
  const postIds = new Set<string>();
  const posts: InstagramPost[] = [];
  for (const raw of value.posts.slice(0, 500)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = safeId(item.id);
    const authorId = safeId(item.authorId);
    const media = Array.isArray(item.media) ? item.media.map(value => safeMedia(value, '')).filter(Boolean).slice(0, 10) : [];
    const ratio = item.ratio as InstagramRatio;
    if (!id || postIds.has(id) || !finalIds.has(authorId) || media.length === 0 || !ratios.includes(ratio)) continue;
    postIds.add(id);
    const commentIds = new Set<string>();
    const comments: InstagramComment[] = Array.isArray(item.comments) ? item.comments.flatMap(comment => {
      if (!comment || typeof comment !== 'object') return [];
      const entry = comment as Record<string, unknown>;
      const commentId = safeId(entry.id);
      const commentAuthor = safeId(entry.authorId);
      const commentText = text(entry.text, 500);
      if (!commentId || commentIds.has(commentId) || !finalIds.has(commentAuthor) || !commentText) return [];
      commentIds.add(commentId);
      return [{ id: commentId, authorId: commentAuthor, text: commentText, createdAt: safeNumber(entry.createdAt, Date.now(), Number.MAX_SAFE_INTEGER), likes: safeNumber(entry.likes) }];
    }).slice(0, 150) : [];
    const tags = Array.isArray(item.tags) ? [...new Set(item.tags.map(tag => text(tag, 40).replace(/^#/, '').replace(/[^a-zA-Z0-9_]/g, '')).filter(Boolean))].slice(0, 15) : [];
    posts.push({ id, authorId, media, ratio, caption: text(item.caption, 1200), location: text(item.location, 100) || undefined, createdAt: safeNumber(item.createdAt, Date.now(), Number.MAX_SAFE_INTEGER), likes: safeNumber(item.likes), commentCount: Math.max(comments.length, safeNumber(item.commentCount, comments.length)), likedByViewer: item.likedByViewer === true, savedByViewer: item.savedByViewer === true, tags, comments });
  }
  const storyIds = new Set<string>();
  const stories: InstagramStory[] = [];
  for (const raw of value.stories.slice(0, 300)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = safeId(item.id);
    const authorId = safeId(item.authorId);
    if (!id || storyIds.has(id) || !finalIds.has(authorId)) continue;
    storyIds.add(id);
    stories.push({ id, authorId, media: safeMedia(item.media), text: text(item.text, 300) || undefined, active: item.active === true, createdAt: safeNumber(item.createdAt, Date.now(), Number.MAX_SAFE_INTEGER) });
  }
  const highlightIds = new Set<string>();
  const highlights: InstagramHighlight[] = [];
  for (const raw of value.highlights.slice(0, 300)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = safeId(item.id);
    const profileId = safeId(item.profileId);
    if (!id || highlightIds.has(id) || !finalIds.has(profileId)) continue;
    highlightIds.add(id);
    highlights.push({ id, profileId, title: text(item.title, 50) || 'À la une', cover: safeMedia(item.cover), storyIds: Array.isArray(item.storyIds) ? [...new Set(item.storyIds.map(safeId).filter(storyId => storyIds.has(storyId)))].slice(0, 25) : [] });
  }
  return reconcileInstagramDatabase({ version: 1, profiles, posts, stories, highlights }, pages);
}

export function reconcileInstagramDatabase(database: InstagramDatabase, pages: WikiPage[]): InstagramDatabase {
  const activePages = pages.filter(page => !page.isTrashed);
  const byWiki = new Map(database.profiles.filter(profile => profile.wikiPageId).map(profile => [profile.wikiPageId, profile]));
  const profiles = database.profiles.filter(profile => !profile.wikiPageId || activePages.some(page => page.id === profile.wikiPageId));

  for (const page of activePages) {
    const existing = byWiki.get(page.id);
    if (existing) {
      const derived = profileFromPage(page);
      const index = profiles.findIndex(profile => profile.id === existing.id);
      if (index >= 0) profiles[index] = {
        ...existing,
        displayName: page.title || existing.displayName,
        avatar: existing.avatar || derived.avatar,
        category: existing.category || derived.category,
      };
    } else {
      const candidate = profileFromPage(page);
      const isTaken = profiles.some(profile => profile.username === candidate.username);
      if (isTaken) candidate.username = `${candidate.username}.${page.id.slice(-4)}`;
      profiles.push(candidate);
    }
  }

  const profileIds = new Set(profiles.map(profile => profile.id));
  const posts = database.posts
    .filter(post => profileIds.has(post.authorId))
    .map(post => ({ ...post, comments: post.comments.filter(comment => profileIds.has(comment.authorId)) }));
  const stories = database.stories.filter(story => profileIds.has(story.authorId));
  const storyIds = new Set(stories.map(story => story.id));
  const highlights = database.highlights
    .filter(highlight => profileIds.has(highlight.profileId))
    .map(highlight => ({ ...highlight, storyIds: highlight.storyIds.filter(id => storyIds.has(id)) }));
  return { ...database, profiles, posts, stories, highlights };
}

export function loadInstagramDatabase(pages: WikiPage[]): InstagramDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      const normalised = normaliseInstagramDatabase(parsed, pages);
      if (normalised) return normalised;
    }
  } catch {
    // A corrupt save is replaced by a usable local seed.
  }
  return seedDatabase(pages);
}

export function saveInstagramDatabase(database: InstagramDatabase) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
}

export function validateImportedInstagram(value: unknown, pages: WikiPage[]): InstagramDatabase | null {
  return normaliseInstagramDatabase(value, pages);
}

export function mediaUrl(filename: string) {
  const uploadedUrl = instagramMediaObjectUrl(filename);
  if (uploadedUrl) return uploadedUrl;
  if (uploadedMediaPath.test(filename)) return filename;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/images/instagram/${safeMedia(filename)}`;
}