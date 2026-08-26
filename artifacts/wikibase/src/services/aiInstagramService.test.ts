import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleInstagramProfiles, isSocialAccountProfile, socialAccountProfiles } from '@/data/socialAccounts';
import { assembleInstagramComments, getInstagramCommentRequirements } from './aiInstagramService';
import type { InstagramProfile } from './instagramStorage';

function profile(id: string, username: string, relations: InstagramProfile['relations'] = []): InstagramProfile {
  return {
    id,
    username,
    displayName: username,
    verified: false,
    accountType: 'athlète / joueur',
    category: 'Caledora',
    bio: '',
    avatar: 'profile.svg',
    reputation: 'populaire',
    personality: 'familier',
    communicationTone: 'institutionnel',
    status: 'populaire',
    followers: 0,
    following: 0,
    relations,
  };
}

test('keeps reference accounts out of selectable Instagram profiles', () => {
  const author = profile('player-author', 'author');
  const teammate = profile('player-teammate', 'teammate');
  const reference = socialAccountProfiles[0];

  const selectable = visibleInstagramProfiles([author, reference, teammate]);
  const requirements = getInstagramCommentRequirements('', '', author, [author, reference, teammate]);

  assert.deepEqual(selectable.map(item => item.id), [author.id, teammate.id]);
  assert.deepEqual(requirements.visibleProfiles.map(item => item.id), [author.id, teammate.id]);
});

test('keeps mandatory commenters and four extra references without a remote AI call', () => {
  const teammate = profile('player-teammate', 'teammate');
  const relation = profile('player-relation', 'relation');
  const author = profile('player-author', 'author', [{ profileId: relation.id, type: 'coéquipier' }]);
  const requestedReference = socialAccountProfiles[0];
  const requirements = getInstagramCommentRequirements(
    `Bravo @${teammate.username} !`,
    `Une réaction de ${requestedReference.displayName} serait bienvenue.`,
    author,
    [author, teammate, relation, socialAccountProfiles[1]],
  );
  const comments = assembleInstagramComments(requirements, author, []);
  const commentIds = new Set(comments.map(comment => comment.authorId));
  const requiredIds = new Set(requirements.required.map(item => item.id));
  const extraReferences = comments.filter(comment => isSocialAccountProfile({ id: comment.authorId }) && !requiredIds.has(comment.authorId));

  assert.ok(requiredIds.has(teammate.id));
  assert.ok(requiredIds.has(relation.id));
  assert.ok(requiredIds.has(requestedReference.id));
  assert.ok([...requiredIds].every(id => commentIds.has(id)));
  assert.ok(extraReferences.length >= 4);
});