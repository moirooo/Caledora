import type { InstagramProfile, InstagramTone } from './instagramStorage';

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
  if (relation === 'couple') return 'Tellement fière de toi. ❤️';
  if (profile.accountType === 'club') return 'Toute la famille est derrière vous. 💙';
  return profile.personality === 'provocateur' ? 'Ça parle beaucoup, mais on regarde. 🔥' : 'Magnifique énergie, continue comme ça. ✨';
};

export async function generateInstagramComments(
  caption: string,
  author: InstagramProfile,
  candidates: InstagramProfile[],
): Promise<AiComment[]> {
  const mentions = [...caption.matchAll(/@([a-z0-9._]+)/gi)].map(match => match[1].toLowerCase());
  const mentioned = candidates.filter(profile => mentions.includes(profile.username.toLowerCase()) && profile.id !== author.id);
  const eligible = candidates.filter(profile => profile.id !== author.id);
  try {
    const response = await fetch('/api/generate-instagram-comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption,
        author,
        mentions: mentioned.map(profile => profile.id),
        candidates: eligible.slice(0, 50),
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
    const required = mentioned.map(profile => byAuthor.get(profile.id) ?? { authorId: profile.id, text: localComment(profile, author.relations.find(item => item.profileId === profile.id)?.type) });
    const extras = [...byAuthor.values()].filter(comment => !mentioned.some(profile => profile.id === comment.authorId)).slice(0, Math.max(0, 4 - required.length));
    if (required.length + extras.length >= Math.min(2, Math.max(1, mentioned.length))) return [...required, ...extras];
  } catch {
    // Local fallback keeps publishing and mention rules usable offline.
  }
  const used = new Set(mentioned.map(profile => profile.id));
  const extras = eligible.filter(profile => !used.has(profile.id)).slice(0, Math.max(0, 3 - mentioned.length))
    .map(profile => ({ authorId: profile.id, text: localComment(profile, author.relations.find(item => item.profileId === profile.id)?.type) }));
  return [
    ...mentioned.map(profile => ({ authorId: profile.id, text: localComment(profile, author.relations.find(item => item.profileId === profile.id)?.type) })),
    ...extras,
  ];
}