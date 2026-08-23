import type { InstagramProfile, InstagramTone } from './instagramStorage';
import { socialAccountMatchesContext } from '@/data/socialAccounts';

export type AiComment = { authorId: string; text: string };

const fallbackCaption = (author: InstagramProfile, context: string, tone: InstagramTone) => {
  const starters: Record<InstagramTone, string> = {
    'célébration': 'Un moment à garder près du cœur.',
    'défaite': 'On apprend, on avance, on revient plus fort.',
    clash: 'On entend le bruit. Nous, on reste concentrés.',
    romance: 'Les plus beaux souvenirs n’ont pas besoin de filtre.',
    officiel: 'Une nouvelle étape importante pour notre communauté.',
  };
  return `${starters[tone]} ${context.trim() || `Merci de vivre cette aventure avec ${author.displayName}.`} ✦`;
};

export async function generateInstagramCaption(author: InstagramProfile, context: string, tone: InstagramTone) {
  try {
    const response = await fetch('/api/generate-instagram-caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, context, tone }),
    });
    const data = await response.json() as { caption?: string };
    if (!response.ok || !data.caption) throw new Error('caption unavailable');
    return data.caption;
  } catch {
    return fallbackCaption(author, context, tone);
  }
}

const localComment = (profile: InstagramProfile, relation?: string) => {
  if (relation === 'rival') return 'On vous attend sur le terrain. 👀';
  if (relation === 'coéquipier') return 'Toujours ensemble, quelle équipe. 💪';
  if (relation === 'conjoint(e)') return 'Tellement fière de toi. ❤️';
  if (profile.accountType === 'club sportif') return 'Toute la famille est derrière vous. 💙';
  return profile.personality === 'provocateur' ? 'Ça parle beaucoup, mais on regarde. 🔥' : 'Magnifique énergie, continue comme ça. ✨';
};

const communityProfilesForCaption = (caption: string, candidates: InstagramProfile[]) => {
  const normalized = caption.toLowerCase();
  const intimateOrCasual = /(amour|cœur|coeur|famille|vacance|week-?end|souvenir|anniversaire|romance|intime|photo)/u.test(normalized);
  const allowedIds = intimateOrCasual
    ? new Set(['community-era', 'community-culture', 'community-vibes', 'community-circle'])
    : new Set(['community-tribune', 'community-era', 'community-zone', 'community-stadium']);
  return candidates.filter(profile => allowedIds.has(profile.id));
};

const uniqueProfiles = (profiles: InstagramProfile[]) => [...new Map(profiles.map(profile => [profile.id, profile])).values()];

export async function generateInstagramComments(
  caption: string,
  context: string,
  author: InstagramProfile,
  candidates: InstagramProfile[],
): Promise<AiComment[]> {
  const mentions = [...caption.matchAll(/@([a-z0-9._]+)/gi)].map(match => match[1].toLowerCase());
  const eligible = candidates.filter(profile => profile.id !== author.id);
  const profilesByUsername = new Map(eligible.map(profile => [profile.username.toLowerCase(), profile]));
  const mentioned = [...new Set(mentions)].map(username => profilesByUsername.get(username)).filter((profile): profile is InstagramProfile => Boolean(profile));
  const related = eligible.filter(profile => author.relations.some(relation => relation.profileId === profile.id) && !mentioned.some(item => item.id === profile.id));
  const normalizedContext = context.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const contextual = socialAccountMatchesContext(context, eligible).filter(profile => !mentioned.some(item => item.id === profile.id) && !related.some(item => item.id === profile.id));
  const explicitlyRequested = contextual.filter(profile => normalizedContext.includes(`@${profile.username.toLowerCase()}`)
    || normalizedContext.includes(profile.username.toLowerCase())
    || normalizedContext.includes(profile.displayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  const required = uniqueProfiles([...explicitlyRequested, ...mentioned, ...related]);
  const community = uniqueProfiles([
    ...contextual,
    ...communityProfilesForCaption(caption, eligible),
  ]).filter(profile => !required.some(item => item.id === profile.id));
  const candidatePool = uniqueProfiles([...required, ...community, ...eligible]).slice(0, 180);
  try {
    const response = await fetch('/api/generate-instagram-comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption,
        context,
        author,
        requiredIds: required.map(profile => profile.id),
        candidates: candidatePool,
      }),
    });
    const data = await response.json() as { comments?: AiComment[] };
    if (!response.ok || !Array.isArray(data.comments)) throw new Error('comments unavailable');
    const allowed = new Set(eligible.map(profile => profile.id));
    const byAuthor = new Map<string, AiComment>();
    data.comments.forEach(comment => {
      if (comment && allowed.has(comment.authorId) && typeof comment.text === 'string' && comment.text.trim()) {
        byAuthor.set(comment.authorId, { authorId: comment.authorId, text: comment.text.trim().slice(0, 400) });
      }
    });
    const requiredComments = required.map(profile => byAuthor.get(profile.id) ?? { authorId: profile.id, text: localComment(profile, author.relations.find(item => item.profileId === profile.id)?.type) });
    const extras = [...byAuthor.values()].filter(comment => community.some(profile => profile.id === comment.authorId) && !required.some(profile => profile.id === comment.authorId)).slice(0, Math.max(0, 4 - requiredComments.length));
    if (requiredComments.length + extras.length >= Math.min(4, Math.max(1, required.length))) return [...requiredComments, ...extras];
  } catch {
    // Local fallback keeps publishing and mention rules usable offline.
  }
  const used = new Set(required.map(profile => profile.id));
  const extras = community.filter(profile => !used.has(profile.id)).slice(0, Math.max(0, 4 - required.length))
    .map(profile => ({ authorId: profile.id, text: localComment(profile, author.relations.find(item => item.profileId === profile.id)?.type) }));
  return [
    ...required.map(profile => ({ authorId: profile.id, text: localComment(profile, author.relations.find(item => item.profileId === profile.id)?.type) })),
    ...extras,
  ];
}