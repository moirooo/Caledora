import type { InstagramProfile, InstagramTone } from './instagramStorage';
import { isSocialAccountProfile, socialAccountProfiles } from '@/data/socialAccounts';

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

const uniqueProfiles = (profiles: InstagramProfile[]) => [...new Map(profiles.map(profile => [profile.id, profile])).values()];
const normalizedValue = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function isExplicitlyRequested(profile: InstagramProfile, context: string) {
  const normalizedContext = normalizedValue(context);
  return normalizedContext.includes(`@${profile.username.toLowerCase()}`)
    || normalizedContext.includes(profile.username.toLowerCase())
    || normalizedContext.includes(normalizedValue(profile.displayName));
}

export async function generateInstagramComments(
  caption: string,
  context: string,
  author: InstagramProfile,
  candidates: InstagramProfile[],
  postMeta: { location?: string; category?: string } = {},
): Promise<AiComment[]> {
  const mentions = [...caption.matchAll(/@([a-z0-9._]+)/gi)].map(match => match[1].toLowerCase());
  const visibleProfiles = candidates.filter(profile => !isSocialAccountProfile(profile));
  const allCandidates = uniqueProfiles([...visibleProfiles, ...socialAccountProfiles]);
  const eligible = allCandidates.filter(profile => profile.id !== author.id);
  const profilesByUsername = new Map(eligible.map(profile => [profile.username.toLowerCase(), profile]));
  const mentioned = [...new Set(mentions)].map(username => profilesByUsername.get(username)).filter((profile): profile is InstagramProfile => Boolean(profile));
  const related = eligible.filter(profile => author.relations.some(relation => relation.profileId === profile.id) && !mentioned.some(item => item.id === profile.id));
  const explicitlyRequested = socialAccountProfiles.filter(profile => profile.id !== author.id && isExplicitlyRequested(profile, context)
    && !mentioned.some(item => item.id === profile.id) && !related.some(item => item.id === profile.id));
  const required = uniqueProfiles([...explicitlyRequested, ...mentioned, ...related]);
  const requiredIds = new Set(required.map(profile => profile.id));
  const referenceProfiles = socialAccountProfiles.filter(profile => profile.id !== author.id);
  const referenceIds = new Set(referenceProfiles.map(profile => profile.id));
  try {
    const response = await fetch('/api/ai/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption,
        context,
        author,
        post: { caption, context, location: postMeta.location ?? '', category: postMeta.category ?? author.category ?? '' },
        mentions: mentioned.map(profile => profile.id),
        contextRequests: explicitlyRequested.map(profile => profile.id),
        relationships: author.relations,
        atmosphere: context || 'spontané et naturel',
        availableAccounts: visibleProfiles,
        referenceAccounts: socialAccountProfiles,
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
    const generatedReferenceComments = [...byAuthor.values()]
      .filter(comment => referenceIds.has(comment.authorId) && !requiredIds.has(comment.authorId));
    const fallbackReferenceComments = referenceProfiles
      .filter(profile => !requiredIds.has(profile.id) && !generatedReferenceComments.some(comment => comment.authorId === profile.id))
      .slice(0, Math.max(0, 4 - generatedReferenceComments.length))
      .map(profile => ({ authorId: profile.id, text: localComment(profile) }));
    return [...requiredComments, ...generatedReferenceComments, ...fallbackReferenceComments];
  } catch {
    // Local fallback keeps publishing and mention rules usable offline.
  }
  const extras = referenceProfiles.filter(profile => !requiredIds.has(profile.id)).slice(0, 4)
    .map(profile => ({ authorId: profile.id, text: localComment(profile) }));
  return [
    ...required.map(profile => ({ authorId: profile.id, text: localComment(profile, author.relations.find(item => item.profileId === profile.id)?.type) })),
    ...extras,
  ];
}