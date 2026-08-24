import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft, BadgeCheck, Bell, Bookmark, ChevronLeft, ChevronRight, Compass,
  Download, Grid3X3, Heart, Home, Image as ImageIcon, MessageCircle, MoreHorizontal,
  Plus, Search, Send, Settings2, Share2, Sparkles, Trash2, Upload, UserRound, X,
} from 'lucide-react';
import type { WikiPage } from '@/lib/wikibase';
import {
  loadInstagramDatabase, mediaUrl, reconcileInstagramDatabase, saveInstagramDatabase, updateInstagramProfile,
  validateImportedInstagram, type InstagramComment, type InstagramDatabase, type InstagramPost,
  type InstagramProfile, type InstagramRatio, type InstagramStory, type InstagramTone,
  instagramAccountTypes, instagramCommunicationTones, instagramPersonalities, instagramRelationTypes,
  instagramReputations, instagramStatuses,
} from '@/services/instagramStorage';
import { generateInstagramCaption, generateInstagramComments } from '@/services/aiInstagramService';
import { hydrateInstagramImages } from '@/services/instagramMediaStorage';
import { isSocialAccountProfile } from '@/data/socialAccounts';
import { getUploadedMedia, uploadMedia } from '@workspace/media-upload';
import '@/components/instagram/instagram.css';

type View = 'feed' | 'explore' | 'profile';
type Modal = 'post' | 'story' | 'settings' | 'profile' | null;
const availableMedia = ['caledora-street.svg', 'matchday.svg', 'team-huddle.svg', 'brand.svg', 'profile.svg'];

const number = (value: number) => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const relativeTime = (timestamp: number) => {
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} j`;
};
const getInitials = (name: string) => name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const commentTotal = (post: InstagramPost) => Math.max(post.comments.length, post.commentCount ?? 0);
const isOrganisation = (type: InstagramProfile['accountType']) => ['club sportif', 'entreprise / marque', 'institution / ville', 'média / presse'].includes(type);
type AutocompleteToken = { kind: 'mention' | 'hashtag'; query: string; start: number; end: number };
type AutocompleteSuggestion = { id: string; label: string; detail: string; avatar?: string };

function activeAutocompleteToken(value: string, cursor: number): AutocompleteToken | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|[\s([{'"])([@#])([\p{L}\p{N}_.-]*)$/u);
  if (!match || !match[2]) return null;
  const token = `${match[1]}${match[2]}`;
  return {
    kind: match[1] === '@' ? 'mention' : 'hashtag',
    query: match[2].toLocaleLowerCase('fr-FR'),
    start: cursor - token.length,
    end: cursor,
  };
}

function AutocompleteField({ value, onChange, profiles, hashtags = [], multiline = false, rows, placeholder, className, ariaLabel, autoFocus = false }: {
  value: string; onChange: (value: string) => void; profiles: InstagramProfile[]; hashtags?: string[];
  multiline?: boolean; rows?: number; placeholder?: string; className?: string; ariaLabel?: string; autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuId = useId();
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(value.length);
  const [activeIndex, setActiveIndex] = useState(0);
  const token = activeAutocompleteToken(value, cursor);
  const suggestions: AutocompleteSuggestion[] = !focused || !token?.query ? [] : token.kind === 'mention'
    ? profiles.filter(profile => `${profile.username} ${profile.displayName}`.toLocaleLowerCase('fr-FR').includes(token.query)).slice(0, 5).map(profile => ({ id: profile.id, label: `@${profile.username}`, detail: profile.displayName, avatar: profile.avatar }))
    : hashtags.filter(tag => tag.toLocaleLowerCase('fr-FR').includes(token.query)).slice(0, 5).map(tag => ({ id: tag, label: `#${tag}`, detail: 'Hashtag populaire' }));

  useEffect(() => setActiveIndex(0), [token?.kind, token?.query]);

  const selectSuggestion = (suggestion: typeof suggestions[number]) => {
    if (!token) return;
    const after = value.slice(token.end);
    const spacer = after && /^\s/u.test(after) ? '' : ' ';
    const next = `${value.slice(0, token.start)}${suggestion.label}${spacer}${after}`;
    const nextCursor = token.start + suggestion.label.length + spacer.length;
    onChange(next);
    window.requestAnimationFrame(() => {
      const field = multiline ? textareaRef.current : inputRef.current;
      field?.focus();
      field?.setSelectionRange(nextCursor, nextCursor);
      setCursor(nextCursor);
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(index => (index + 1) % suggestions.length); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => (index - 1 + suggestions.length) % suggestions.length); }
    if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); selectSuggestion(suggestions[activeIndex] ?? suggestions[0]); }
    if (event.key === 'Escape') { event.preventDefault(); setFocused(false); }
  };

  const commonProps = {
    value,
    placeholder,
    className: 'ig-autocomplete-input',
    'aria-label': ariaLabel,
    role: 'combobox',
    'aria-autocomplete': 'list' as const,
    'aria-expanded': suggestions.length > 0,
    'aria-controls': menuId,
    'aria-activedescendant': suggestions.length > 0 ? `${menuId}-option-${activeIndex}` : undefined,
    autoFocus,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(event.target.value);
      setCursor(event.target.selectionStart ?? event.target.value.length);
    },
    onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFocused(true);
      setCursor(event.currentTarget.selectionStart ?? value.length);
    },
    onClick: (event: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => setCursor(event.currentTarget.selectionStart ?? value.length),
    onKeyUp: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => setCursor(event.currentTarget.selectionStart ?? value.length),
    onKeyDown: handleKeyDown,
    onBlur: () => setFocused(false),
  };

  return <div className={`ig-autocomplete-field ${className ?? ''}`}>
    {multiline ? <textarea {...commonProps} ref={textareaRef} rows={rows} /> : <input {...commonProps} ref={inputRef} type="text" />}
    {suggestions.length > 0 && <div className="ig-autocomplete-menu" id={menuId} role="listbox" aria-label={token?.kind === 'mention' ? 'Suggestions de comptes' : 'Suggestions de hashtags'}>
      {suggestions.map((suggestion, index) => <button type="button" id={`${menuId}-option-${index}`} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'active' : ''} key={`${token?.kind}-${suggestion.id}`} onMouseDown={event => { event.preventDefault(); selectSuggestion(suggestion); }}>
        {suggestion.avatar ? <img src={mediaUrl(suggestion.avatar)} alt="" /> : <span className="ig-autocomplete-tag">#</span>}
        <span><b>{suggestion.label}</b><small>{suggestion.detail}</small></span>
      </button>)}
    </div>}
  </div>;
}

function searchValue(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR');
}

function ProfileSearchField({ profiles, value, onChange, excludeId, placeholder = 'Rechercher un compte…', ariaLabel, autoFocus = false }: {
  profiles: InstagramProfile[];
  value: string;
  onChange: (profileId: string) => void;
  excludeId?: string;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}) {
  const selectedProfile = profiles.find(profile => profile.id === value);
  const [query, setQuery] = useState(() => selectedProfile?.displayName ?? '');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuId = useId();
  const suggestions = !focused || !query.trim() ? [] : profiles
    .filter(profile => profile.id !== excludeId)
    .filter(profile => `${searchValue(profile.displayName)} ${searchValue(profile.username)}`.includes(searchValue(query)))
    .slice(0, 7);

  useEffect(() => setActiveIndex(0), [query]);

  const selectProfile = (profile: InstagramProfile) => {
    onChange(profile.id);
    setQuery(profile.displayName);
    setFocused(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(index => (index + 1) % suggestions.length); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => (index - 1 + suggestions.length) % suggestions.length); }
    if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); selectProfile(suggestions[activeIndex] ?? suggestions[0]); }
    if (event.key === 'Escape') { event.preventDefault(); setFocused(false); }
  };

  return <div className="ig-autocomplete-field ig-profile-picker">
    <input
      value={query}
      placeholder={placeholder}
      className="ig-autocomplete-input"
      aria-label={ariaLabel}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={suggestions.length > 0}
      aria-controls={menuId}
      aria-activedescendant={suggestions.length > 0 ? `${menuId}-option-${activeIndex}` : undefined}
      autoFocus={autoFocus}
      onChange={event => { setQuery(event.target.value); if (value) onChange(''); }}
      onFocus={() => setFocused(true)}
      onKeyDown={handleKeyDown}
      onBlur={() => setFocused(false)}
    />
    {suggestions.length > 0 && <div className="ig-autocomplete-menu" id={menuId} role="listbox" aria-label="Suggestions de comptes">
      {suggestions.map((profile, index) => <button
        type="button"
        id={`${menuId}-option-${index}`}
        role="option"
        aria-selected={index === activeIndex}
        className={index === activeIndex ? 'active' : ''}
        key={profile.id}
        onMouseDown={event => { event.preventDefault(); selectProfile(profile); }}
      >
        {profile.avatar ? <img src={mediaUrl(profile.avatar)} alt="" /> : <span className="ig-autocomplete-tag">{getInitials(profile.displayName)}</span>}
        <span><b>{profile.displayName}</b><small>@{profile.username}</small></span>
      </button>)}
    </div>}
  </div>;
}

function Avatar({ profile, size = 42, story = false, onClick }: { profile: InstagramProfile; size?: number; story?: boolean; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      onKeyDown={event => { if (onClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick(); } }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`ig-avatar ${story ? 'ig-avatar-story' : ''}`}
      style={{ width: size, height: size }}
      aria-label={onClick ? `Ouvrir le profil ${profile.displayName}` : undefined}
    >
      <span className="ig-avatar-inner">
        {profile.avatar ? <img src={mediaUrl(profile.avatar)} alt="" /> : <span>{getInitials(profile.displayName)}</span>}
      </span>
    </span>
  );
}

function RichText({ text, profiles, onProfile, onHashtag }: { text: string; profiles: InstagramProfile[]; onProfile: (id: string) => void; onHashtag: (tag: string) => void }) {
  const parts = text.split(/(@[a-z0-9._]+|#[\p{L}0-9_]+)/giu);
  return <>{parts.map((part, index) => {
    if (part.startsWith('@')) {
      const profile = profiles.find(item => item.username.toLowerCase() === part.slice(1).toLowerCase());
      return profile ? <button className="ig-text-link" onClick={() => onProfile(profile.id)} key={`${part}-${index}`}>{part}</button> : <span key={`${part}-${index}`}>{part}</span>;
    }
    if (part.startsWith('#')) return <button className="ig-text-link" onClick={() => onHashtag(part.slice(1))} key={`${part}-${index}`}>{part}</button>;
    return <span key={`${part}-${index}`}>{part}</span>;
  })}</>;
}

function InlineComments({ post, profiles, onProfile, onHashtag }: { post: InstagramPost; profiles: InstagramProfile[]; onProfile: (id: string) => void; onHashtag: (tag: string) => void }) {
  const total = commentTotal(post);
  const estimated = Math.max(0, total - post.comments.length);
  return <section className="ig-inline-comments" aria-label={`Commentaires de la publication (${number(total)})`}>
    {estimated > 0 && <p className="ig-comment-estimate">{post.comments.length ? `${number(post.comments.length)} commentaire${post.comments.length > 1 ? 's' : ''} affiché${post.comments.length > 1 ? 's' : ''} · environ ${number(total)} interactions` : `Environ ${number(total)} commentaires simulés pour cette publication.`}</p>}
    {post.comments.length === 0 && estimated === 0 ? <p className="ig-empty-small">Pas encore de commentaire.</p> : post.comments.map(comment => {
      const author = profiles.find(profile => profile.id === comment.authorId);
      return author ? <div className="ig-inline-comment" key={comment.id}><Avatar profile={author} size={25} onClick={() => onProfile(author.id)} /><p><button onClick={() => onProfile(author.id)}>{author.username}</button> <RichText text={comment.text} profiles={profiles} onProfile={onProfile} onHashtag={onHashtag} /><small>{relativeTime(comment.createdAt)}</small></p></div> : null;
    })}
  </section>;
}

function PostMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return <div className="ig-post-menu">
    <button className="ig-icon-button" onClick={() => setOpen(value => !value)} aria-label="Options de publication" aria-expanded={open}><MoreHorizontal size={21} /></button>
    {open && <div className="ig-post-menu-popover">
      <button onClick={() => { setOpen(false); onEdit(); }}>Modifier la publication</button>
      <button className="danger" onClick={() => { setOpen(false); onDelete(); }}>Supprimer la publication</button>
    </div>}
  </div>;
}

function PostCard({
  post, profiles, editor, commentsOpen, regenerating, onProfile, onHashtag, onToggleLike, onToggleSave, onToggleComments, onRegenerate, onEdit, onDelete,
}: {
  post: InstagramPost; profiles: InstagramProfile[]; editor: boolean; onProfile: (id: string) => void;
  commentsOpen: boolean; regenerating: boolean; onHashtag: (tag: string) => void; onToggleLike: () => void; onToggleSave: () => void; onToggleComments: () => void; onRegenerate: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [slide, setSlide] = useState(0);
  const author = profiles.find(profile => profile.id === post.authorId);
  if (!author) return null;
  const media = post.media.length ? post.media : ['Instagram.png'];
  return (
    <article className="ig-post" aria-busy={regenerating}>
      <header className="ig-post-header">
        <Avatar profile={author} size={34} onClick={() => onProfile(author.id)} />
        <button className="ig-post-author" onClick={() => onProfile(author.id)}>
          <span>{author.username}{author.verified && <BadgeCheck size={13} fill="#0095f6" color="#fff" />}</span>
          {post.location && <small>{post.location}</small>}
        </button>
        {editor && <PostMenu onEdit={onEdit} onDelete={onDelete} />}
      </header>
      <div className={`ig-post-media ${media.length > 1 ? 'ig-carousel-media ig-ratio-portrait' : 'ig-single-media'}`}>
        <img src={mediaUrl(media[slide])} alt={`Publication de ${author.displayName}`} />
        {media.length > 1 && <>
          {slide > 0 && <button className="ig-carousel-arrow ig-carousel-prev" onClick={() => setSlide(value => value - 1)} aria-label="Image précédente"><ChevronLeft size={22} /></button>}
          {slide < media.length - 1 && <button className="ig-carousel-arrow ig-carousel-next" onClick={() => setSlide(value => value + 1)} aria-label="Image suivante"><ChevronRight size={22} /></button>}
          <span className="ig-carousel-count">{slide + 1}/{media.length}</span>
          <div className="ig-carousel-dots">{media.map((_, index) => <span key={index} className={index === slide ? 'active' : ''} />)}</div>
        </>}
      </div>
      <div className="ig-post-body">
        <div className="ig-actions">
          <div>
            <button onClick={onToggleLike} className={`ig-icon-button ${post.likedByViewer ? 'liked' : ''}`} aria-label="J’aime"><Heart size={26} fill={post.likedByViewer ? 'currentColor' : 'none'} /></button>
            <button onClick={onToggleComments} className="ig-icon-button" aria-label={commentsOpen ? 'Masquer les commentaires' : 'Afficher les commentaires'} aria-expanded={commentsOpen}><MessageCircle size={26} /></button>
            <button className="ig-icon-button" aria-label="Partager"><Send size={26} /></button>
          </div>
          <button onClick={onToggleSave} className="ig-icon-button" aria-label="Enregistrer"><Bookmark size={26} fill={post.savedByViewer ? 'currentColor' : 'none'} /></button>
        </div>
        <p className="ig-likes">{number(post.likes)} J’aime</p>
        <p className="ig-caption"><button onClick={() => onProfile(author.id)}>{author.username}</button> <RichText text={post.caption} profiles={profiles} onProfile={onProfile} onHashtag={onHashtag} /></p>
        {post.tags && post.tags.length > 0 && <p className="ig-tags">{post.tags.map(tag => <button key={tag} className="ig-text-link" onClick={() => onHashtag(tag)}>#{tag}</button>)}</p>}
        <button className="ig-comments-link" onClick={onToggleComments}>{commentsOpen ? 'Masquer les commentaires' : `Afficher les ${number(commentTotal(post))} commentaires`}</button>
        {commentsOpen && <InlineComments post={post} profiles={profiles} onProfile={onProfile} onHashtag={onHashtag} />}
        <p className="ig-date">{relativeTime(post.createdAt)}</p>
        {editor && <button className="ig-editor-link" onClick={onRegenerate} disabled={regenerating}><Sparkles size={14} /> {regenerating ? 'Génération des commentaires…' : 'Régénérer les commentaires'}</button>}
      </div>
    </article>
  );
}

function StoryViewer({ stories, profiles, start, onClose }: { stories: InstagramStory[]; profiles: InstagramProfile[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const story = stories[index];
  const author = profiles.find(profile => profile.id === story?.authorId);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setIndex(value => Math.min(stories.length - 1, value + 1));
      if (event.key === 'ArrowLeft') setIndex(value => Math.max(0, value - 1));
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [onClose, stories.length]);
  if (!story || !author) return null;
  return <div className="ig-story-overlay" role="dialog" aria-modal="true">
    <div className="ig-story-shell">
      <div className="ig-story-progress">{stories.map((_, itemIndex) => <span key={itemIndex} className={itemIndex <= index ? 'done' : ''} />)}</div>
      <img src={mediaUrl(story.media)} alt="" className="ig-story-image" />
      <div className="ig-story-top"><div className="ig-story-person"><Avatar profile={author} size={34} /><b>{author.username}</b><span>{relativeTime(story.createdAt)}</span></div><button onClick={onClose} className="ig-icon-button" aria-label="Fermer"><X size={26} /></button></div>
      {story.text && <p className="ig-story-text">{story.text}</p>}
      {index > 0 && <button className="ig-story-nav ig-story-left" onClick={() => setIndex(value => value - 1)}><ChevronLeft /></button>}
      {index < stories.length - 1 && <button className="ig-story-nav ig-story-right" onClick={() => setIndex(value => value + 1)}><ChevronRight /></button>}
    </div>
  </div>;
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div className="ig-overlay" onMouseDown={onClose}><section className="ig-dialog" onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
    <header className="ig-dialog-header"><b>{title}</b><button className="ig-icon-button" onClick={onClose} aria-label="Fermer"><X size={26} /></button></header>{children}
  </section></div>;
}

function PostDetail({ post, profiles, selectableProfiles, hashtags, editor, onClose, onProfile, onHashtag, onAddComment, onEditComment, onDeleteComment, onEditPost, onDeletePost }: {
  post: InstagramPost; profiles: InstagramProfile[]; selectableProfiles: InstagramProfile[]; editor: boolean; onClose: () => void; onProfile: (id: string) => void;
  hashtags: string[]; onHashtag: (tag: string) => void;
  onAddComment: (authorId: string, text: string) => void; onEditComment: (commentId: string, text: string) => void; onDeleteComment: (commentId: string) => void; onEditPost: () => void; onDeletePost: () => void;
}) {
  const [comment, setComment] = useState('');
  const [commentAuthorId, setCommentAuthorId] = useState(selectableProfiles[0]?.id ?? '');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const author = profiles.find(profile => profile.id === post.authorId);
  const firstMedia = post.media[0] || 'Instagram.png';
  const totalComments = commentTotal(post);
  const estimatedComments = Math.max(0, totalComments - post.comments.length);
  if (!author) return null;
  return <Overlay title="Publication" onClose={onClose}><div className="ig-post-detail">
    <div className="ig-detail-media"><img src={mediaUrl(firstMedia)} alt="" /></div>
    <div className="ig-detail-comments">
      <div className="ig-detail-author"><Avatar profile={author} size={36} onClick={() => onProfile(author.id)} /><p><b>{author.username}</b><br /><RichText text={post.caption} profiles={profiles} onProfile={onProfile} onHashtag={onHashtag} /></p>{editor && <PostMenu onEdit={onEditPost} onDelete={onDeletePost} />}</div>
      <div className="ig-comment-list">{estimatedComments > 0 && <p className="ig-comment-estimate">{post.comments.length > 0 ? `${number(post.comments.length)} commentaire${post.comments.length > 1 ? 's' : ''} affiché${post.comments.length > 1 ? 's' : ''} · environ ${number(totalComments)} interactions` : `Environ ${number(totalComments)} commentaires simulés pour cette publication. Les réponses locales apparaîtront ici après leur génération.`}</p>}{post.comments.length === 0 && estimatedComments === 0 ? <p className="ig-empty-small">Pas encore de commentaire.</p> : post.comments.map(item => {
        const commenter = profiles.find(profile => profile.id === item.authorId);
        return commenter ? <div className="ig-comment" key={item.id}><Avatar profile={commenter} size={28} onClick={() => onProfile(commenter.id)} />{editingCommentId === item.id ? <form className="ig-comment-edit" onSubmit={event => { event.preventDefault(); if (editingText.trim()) { onEditComment(item.id, editingText.trim()); setEditingCommentId(null); } }}><AutocompleteField autoFocus value={editingText} onChange={setEditingText} profiles={selectableProfiles} hashtags={hashtags} ariaLabel="Modifier le commentaire" /><div><button type="submit">Enregistrer</button><button type="button" onClick={() => setEditingCommentId(null)}>Annuler</button></div></form> : <p><b>{commenter.username}</b><br /><RichText text={item.text} profiles={profiles} onProfile={onProfile} onHashtag={onHashtag} /><small>{relativeTime(item.createdAt)}</small></p>}{editor && editingCommentId !== item.id && <span className="ig-comment-actions"><button onClick={() => { setEditingCommentId(item.id); setEditingText(item.text); }} aria-label="Modifier ce commentaire">Modifier</button><button className="ig-comment-delete" onClick={() => onDeleteComment(item.id)} aria-label="Supprimer ce commentaire"><Trash2 size={14} /></button></span>}</div> : null;
      })}</div>
      {editor && <form className="ig-comment-form" onSubmit={event => { event.preventDefault(); if (comment.trim() && commentAuthorId) { onAddComment(commentAuthorId, comment.trim()); setComment(''); } }}>
        <select value={commentAuthorId} onChange={event => setCommentAuthorId(event.target.value)} aria-label="Compte qui commente">{selectableProfiles.map(profile => <option key={profile.id} value={profile.id}>@{profile.username}</option>)}</select>
        <AutocompleteField value={comment} onChange={setComment} profiles={selectableProfiles} hashtags={hashtags} placeholder="Ajouter un commentaire…" className="ig-comment-composer" ariaLabel="Ajouter un commentaire" /><button disabled={!comment.trim()}>Publier</button>
      </form>}
    </div>
  </div></Overlay>;
}

export function InstagramApp({ pages }: { pages: WikiPage[] }) {
  const [, navigate] = useLocation();
  const [database, setDatabase] = useState<InstagramDatabase>(() => loadInstagramDatabase(pages));
  const [view, setView] = useState<View>('feed');
  const [profileId, setProfileId] = useState('');
  const [editor, setEditor] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [editingPost, setEditingPost] = useState<InstagramPost | null>(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(() => new Set());
  const [generatingPostId, setGeneratingPostId] = useState<string | null>(null);
  const [storyStart, setStoryStart] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [, setMediaRevision] = useState(0);
  const uploadRef = useRef<HTMLInputElement>(null);
  const databaseRef = useRef<InstagramDatabase>(database);

  const commitDatabase = (next: InstagramDatabase) => {
    databaseRef.current = next;
    saveInstagramDatabase(next);
    setDatabase(next);
  };

  useEffect(() => {
    commitDatabase(reconcileInstagramDatabase(databaseRef.current, pages));
  }, [pages]);

  useEffect(() => {
    databaseRef.current = database;
    saveInstagramDatabase(database);
  }, [database]);

  useEffect(() => {
    const media = database.posts.flatMap(post => post.media).concat(database.stories.map(story => story.media));
    void hydrateInstagramImages(media)
      .then(() => setMediaRevision(revision => revision + 1))
      .catch(() => setNotice('Une image enregistrée n’a pas pu être rechargée.'));
  }, [database.posts, database.stories]);

  const updateDatabase = (updater: (current: InstagramDatabase) => InstagramDatabase) => commitDatabase(updater(databaseRef.current));
  const profiles = database.profiles;
  const visibleProfiles = useMemo(() => profiles.filter(profile => !isSocialAccountProfile(profile)), [profiles]);
  const visibleProfileIds = useMemo(() => new Set(visibleProfiles.map(profile => profile.id)), [visibleProfiles]);
  const feed = useMemo(() => database.posts
    .filter(post => visibleProfileIds.has(post.authorId))
    .sort((a, b) => b.createdAt - a.createdAt), [database.posts, visibleProfileIds]);
  const hashtags = useMemo(() => {
    const counts = new Map<string, number>();
    feed.forEach(post => {
      const values = [...(post.tags ?? []), ...[...post.caption.matchAll(/#([\p{L}0-9_]+)/giu)].map(match => match[1])];
      values.forEach(tag => {
        const normalized = tag.trim().replace(/^#/, '');
        if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      });
    });
    return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'fr')).map(([tag]) => tag);
  }, [feed]);
  const currentProfile = visibleProfiles.find(profile => profile.id === profileId) ?? visibleProfiles[0];
  const activeStories = database.stories.filter(story => story.active && visibleProfileIds.has(story.authorId));
  const exploredPosts = useMemo(() => {
    if (!search.startsWith('#')) return feed;
    const tag = search.slice(1).trim().toLowerCase();
    if (!tag) return [];
    return feed.filter(post => post.tags?.some(item => item.toLowerCase() === tag) || [...post.caption.matchAll(/#([\p{L}0-9_]+)/giu)].some(match => match[1].toLowerCase() === tag));
  }, [feed, search]);
  const openProfile = (id: string) => {
    if (!visibleProfileIds.has(id)) return;
    setSelectedPost(null); setProfileId(id); setView('profile'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openHashtag = (tag: string) => { setSelectedPost(null); setSearch(`#${tag.replace(/^#/, '')}`); setView('explore'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const viewer = visibleProfiles.find(profile => profile.id === 'caledora-official') ?? visibleProfiles[0];

  const editPost = (id: string, patch: Partial<InstagramPost>) => updateDatabase(current => ({ ...current, posts: current.posts.map(post => post.id === id ? { ...post, ...patch } : post) }));
  const toggleLike = (post: InstagramPost) => editPost(post.id, { likedByViewer: !post.likedByViewer, likes: post.likes + (post.likedByViewer ? -1 : 1) });
  const deletePost = (postId: string) => {
    if (!window.confirm('Supprimer cette publication et ses commentaires ?')) return;
    updateDatabase(current => ({ ...current, posts: current.posts.filter(post => post.id !== postId) }));
    setSelectedPost(null); setEditingPost(null); setNotice('Publication supprimée.');
  };
  const addComment = (postId: string, authorId: string, text: string) => {
    if (!visibleProfileIds.has(authorId)) return;
    const comment: InstagramComment = { id: `ig-comment-${Date.now()}`, authorId, text, createdAt: Date.now(), likes: 0 };
    updateDatabase(current => ({ ...current, posts: current.posts.map(post => post.id === postId ? { ...post, comments: [...post.comments, comment], commentCount: Math.max(commentTotal(post) + 1, post.comments.length + 1) } : post) }));
  };
  const regenerate = async (post: InstagramPost) => {
    if (generatingPostId) return;
    const author = profiles.find(profile => profile.id === post.authorId);
    if (!author) return;
    setGeneratingPostId(post.id);
    setNotice('Commentaires en cours de génération…');
    try {
      const generated = await generateInstagramComments(post.caption, post.context ?? '', author, visibleProfiles, { location: post.location, category: author.category });
      editPost(post.id, { comments: generated.map((comment, index) => ({ id: `ig-ai-${Date.now()}-${index}`, authorId: comment.authorId, text: comment.text, createdAt: Date.now(), likes: Math.floor(Math.random() * 48) })), commentCount: Math.max(commentTotal(post), generated.length) });
      setNotice('Commentaires mis à jour.');
    } finally {
      setGeneratingPostId(null);
    }
  };

  const exportSave = () => {
    const blob = new Blob([JSON.stringify(database, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'caledora-instagram-save.json'; anchor.click();
    URL.revokeObjectURL(url);
  };
  const importSave = async (file?: File) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const checked = validateImportedInstagram(parsed, pages);
      if (!checked) throw new Error('invalid');
      commitDatabase(checked); setNotice('Sauvegarde Instagram importée.');
    } catch {
      setNotice('Ce fichier ne correspond pas à une sauvegarde Instagram valide.');
    }
  };

  return <div className="instagram-app">
    <aside className="ig-sidebar">
      <button className="ig-wordmark" onClick={() => { setView('feed'); setProfileId(''); }}>Instagram</button>
      <nav>
        <button className={view === 'feed' ? 'active' : ''} onClick={() => setView('feed')}><Home /> <span>Accueil</span></button>
        <button className={view === 'explore' ? 'active' : ''} onClick={() => setView('explore')}><Search /> <span>Recherche</span></button>
        <button onClick={() => setView('explore')}><Compass /> <span>Explorer</span></button>
        <button onClick={() => setNotice('La messagerie reste un aperçu local dans cette version.')}><Send /> <span>Messages</span></button>
        <button onClick={() => setNotice('Aucune nouvelle notification.')}><Heart /> <span>Notifications</span></button>
        {editor && <button onClick={() => setModal('post')}><Plus /> <span>Créer</span></button>}
        {viewer && <button className={view === 'profile' && currentProfile?.id === viewer.id ? 'active' : ''} onClick={() => openProfile(viewer.id)}><UserRound /> <span>Profil</span></button>}
      </nav>
      <div className="ig-sidebar-bottom">
        <button className={editor ? 'active' : ''} onClick={() => setEditor(value => !value)} style={{ color: editor ? 'var(--ig-blue)' : 'inherit' }}>
          <Settings2 size={24} /> <span style={{ fontWeight: editor ? 700 : 400 }}>{editor ? 'Mode Éditeur actif' : 'Mode Viewer'}</span>
        </button>
        <button onClick={() => navigate('/')}><ArrowLeft size={24} /> <span>Retour au Hub</span></button>
      </div>
    </aside>

    <main className="ig-main">
      <header className="ig-mobile-header">
        <div className="ig-mobile-left">
          <button className="ig-icon-button" onClick={() => navigate('/')} aria-label="Retour au Hub"><ArrowLeft size={26} /></button>
          <button className="ig-wordmark" onClick={() => { setView('feed'); setProfileId(''); }}>Instagram</button>
        </div>
        <div className="ig-mobile-right">
          <button className="ig-icon-button" onClick={() => setNotice('La messagerie reste un aperçu local dans cette version.')} aria-label="Messages"><Send size={24} /></button>
          <button className="ig-icon-button" onClick={() => setEditor(value => !value)} aria-label={editor ? 'Désactiver le Mode Éditeur' : 'Activer le Mode Éditeur'} style={{ color: editor ? 'var(--ig-blue)' : 'inherit' }}>
            <Settings2 size={24} />
          </button>
        </div>
      </header>
      {notice && <div className="ig-notice" role="status">{notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}

      {view === 'feed' && <section className="ig-feed">
        <div className="ig-stories">
          <button className="ig-story-item" onClick={() => editor ? setModal('story') : setNotice('Passez en mode Éditeur pour ajouter une story.')}><span className="ig-add-story"><Plus size={17} /></span><span>Votre story</span></button>
          {activeStories.map((story, index) => {
            const profile = visibleProfiles.find(item => item.id === story.authorId);
            return profile ? <button className="ig-story-item" key={story.id} onClick={() => setStoryStart(index)}><Avatar profile={profile} size={58} story /><span>{profile.username}</span></button> : null;
          })}
        </div>
        {feed.length === 0 ? <div className="ig-empty"><ImageIcon size={34} /><h2>Aucune publication</h2><p>Créez la première histoire de Caledora.</p></div> : feed.map(post => <PostCard key={post.id} post={post} profiles={profiles} editor={editor} commentsOpen={expandedCommentIds.has(post.id)} regenerating={generatingPostId === post.id} onProfile={openProfile} onHashtag={openHashtag} onToggleLike={() => toggleLike(post)} onToggleSave={() => editPost(post.id, { savedByViewer: !post.savedByViewer })} onToggleComments={() => setExpandedCommentIds(current => { const next = new Set(current); next.has(post.id) ? next.delete(post.id) : next.add(post.id); return next; })} onRegenerate={() => regenerate(post)} onEdit={() => setEditingPost(post)} onDelete={() => deletePost(post.id)} />)}
      </section>}

      {view === 'explore' && <section className="ig-explore">
        <div className="ig-search"><Search size={18} /><input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher des personnes et des comptes" /></div>
        <h1>Explorer</h1>
        {!search.startsWith('#') && <div className="ig-people">{visibleProfiles.filter(profile => `${profile.displayName} ${profile.username}`.toLowerCase().includes(search.toLowerCase())).map(profile => <button className="ig-person-card" key={profile.id} onClick={() => openProfile(profile.id)}><Avatar profile={profile} size={56} /><span><b>{profile.displayName}{profile.verified && <BadgeCheck size={14} fill="#0095f6" color="#fff" />}</b><small>@{profile.username} · {profile.accountType}</small></span></button>)}</div>}
        {search.startsWith('#') && <h2 className="ig-hashtag-title">Publications {search}</h2>}
        <div className="ig-explore-grid">{exploredPosts.map(post => <button key={post.id} onClick={() => setSelectedPost(post)}><img src={mediaUrl(post.media[0] || 'Instagram.png')} alt="" /><span><Heart size={17} fill="currentColor" /> {number(post.likes)}</span></button>)}</div>
      </section>}

      {view === 'profile' && currentProfile && <ProfileView profile={currentProfile} profiles={visibleProfiles} posts={feed.filter(post => post.authorId === currentProfile.id)} highlights={database.highlights.filter(item => item.profileId === currentProfile.id)} editor={editor} onBack={() => setView('feed')} onEdit={() => setModal('profile')} onPost={setSelectedPost} onProfile={openProfile} onHashtag={tag => { setSearch(`#${tag}`); setView('explore'); }} onFollow={() => updateDatabase(current => ({ ...current, profiles: current.profiles.map(profile => profile.id === currentProfile.id ? { ...profile, followingByViewer: !profile.followingByViewer, followers: profile.followers + (profile.followingByViewer ? -1 : 1) } : profile) }))} />}
    </main>

    <nav className="ig-bottom-nav">
      <button className={view === 'feed' ? 'active' : ''} onClick={() => setView('feed')} aria-label="Accueil"><Home size={26} /></button>
      <button className={view === 'explore' ? 'active' : ''} onClick={() => setView('explore')} aria-label="Recherche"><Search size={26} /></button>
      {editor ? <button onClick={() => setModal('post')} aria-label="Créer une publication"><Plus size={26} /></button> : <button onClick={() => setNotice('Passez en mode Éditeur pour créer une publication.')} aria-label="Créer une publication"><Plus size={26} /></button>}
      <button onClick={() => setNotice('Aucune nouvelle notification.')} aria-label="Notifications"><Heart size={26} /></button>
      <button className={view === 'profile' && currentProfile?.id === viewer?.id ? 'active' : ''} onClick={() => viewer ? openProfile(viewer.id) : null} aria-label="Profil">{viewer ? <Avatar profile={viewer} size={28} /> : <UserRound size={26} />}</button>
    </nav>

      {storyStart !== null && <StoryViewer stories={activeStories} profiles={profiles} start={storyStart} onClose={() => setStoryStart(null)} />}
    {selectedPost && <PostDetail post={database.posts.find(post => post.id === selectedPost.id) ?? selectedPost} profiles={profiles} selectableProfiles={visibleProfiles} hashtags={hashtags} editor={editor} onClose={() => setSelectedPost(null)} onProfile={openProfile} onHashtag={openHashtag} onAddComment={(authorId, text) => addComment(selectedPost.id, authorId, text)} onEditComment={(commentId, text) => updateDatabase(current => ({ ...current, posts: current.posts.map(post => post.id === selectedPost.id ? { ...post, comments: post.comments.map(comment => comment.id === commentId ? { ...comment, text } : comment) } : post) }))} onDeleteComment={commentId => updateDatabase(current => ({ ...current, posts: current.posts.map(post => post.id === selectedPost.id ? { ...post, comments: post.comments.filter(comment => comment.id !== commentId), commentCount: Math.max(post.comments.filter(comment => comment.id !== commentId).length, Math.max(0, commentTotal(post) - 1)) } : post) }))} onEditPost={() => { setEditingPost(selectedPost); setSelectedPost(null); }} onDeletePost={() => deletePost(selectedPost.id)} />}
    {modal === 'post' && <CreatePostModal profiles={visibleProfiles} hashtags={hashtags} onClose={() => setModal(null)} onUploadImage={async file => (await uploadMedia(file, 'instagram')).path} onCreate={async (draft) => {
      const author = visibleProfiles.find(profile => profile.id === draft.authorId); if (!author) return;
      const popularity = Math.max(700, author.followers);
      const likes = Math.max(36, Math.round(popularity * (0.015 + Math.min(0.035, author.followers / 1_000_000))));
      const post: InstagramPost = { id: `ig-post-${Date.now()}`, authorId: author.id, media: draft.media, ratio: draft.ratio, caption: draft.caption, context: draft.context || undefined, location: draft.location || undefined, createdAt: Date.now(), likes, commentCount: Math.max(4, Math.round(likes * 0.045)), tags: [...new Set([...draft.caption.matchAll(/#([\p{L}0-9_]+)/giu)].map(match => match[1]))].slice(0, 15), comments: [] };
      updateDatabase(current => ({ ...current, posts: [post, ...current.posts] })); setModal(null); setView('feed'); setGeneratingPostId(post.id); setNotice('Publication partagée. Commentaires en cours de génération…');
      try {
        const generated = await generateInstagramComments(post.caption, post.context ?? '', author, visibleProfiles, { location: post.location, category: author.category });
        editPost(post.id, { comments: generated.map((comment, index) => ({ id: `ig-ai-${Date.now()}-${index}`, authorId: comment.authorId, text: comment.text, createdAt: Date.now(), likes: 0 })), commentCount: Math.max(post.commentCount ?? 0, generated.length) });
        setNotice('Publication et commentaires partagés.');
      } finally {
        setGeneratingPostId(null);
      }
    }} />}
    {editingPost && <EditPostModal post={database.posts.find(post => post.id === editingPost.id) ?? editingPost} profiles={visibleProfiles} hashtags={hashtags} onClose={() => setEditingPost(null)} onSave={patch => { editPost(editingPost.id, patch); setEditingPost(null); setNotice('Publication mise à jour.'); }} onDelete={() => deletePost(editingPost.id)} />}
    {modal === 'story' && <CreateStoryModal profiles={visibleProfiles} onClose={() => setModal(null)} onUploadImage={async file => (await uploadMedia(file, 'instagram')).path} onCreate={story => { updateDatabase(current => ({ ...current, stories: [story, ...current.stories] })); setModal(null); setNotice('Story ajoutée.'); }} />}
     {modal === 'profile' && currentProfile && <EditProfileModal profile={currentProfile} profiles={visibleProfiles} onClose={() => setModal(null)} onUploadImage={async file => (await uploadMedia(file, 'instagram')).path} onSave={profile => { updateDatabase(current => updateInstagramProfile(current, profile)); setModal(null); setNotice('Profil mis à jour.'); }} />}
    {modal === 'settings' && <Overlay title="Gestion Instagram" onClose={() => setModal(null)}><InstagramSettings database={{ ...database, profiles: visibleProfiles, stories: database.stories.filter(story => visibleProfileIds.has(story.authorId)) }} onExport={exportSave} onImport={() => uploadRef.current?.click()} onToggleStory={storyId => updateDatabase(current => ({ ...current, stories: current.stories.map(story => story.id === storyId ? { ...story, active: !story.active } : story) }))} onCreateHighlight={(storyId, title) => {
      const story = database.stories.find(item => item.id === storyId);
      if (!story) return;
      updateDatabase(current => ({ ...current, highlights: [...current.highlights, { id: `ig-highlight-${Date.now()}`, profileId: story.authorId, title, cover: story.media, storyIds: [story.id] }] }));
      setNotice('Story ajoutée aux stories à la une.');
    }} /><input ref={uploadRef} type="file" accept="application/json" hidden onChange={event => { importSave(event.target.files?.[0]); event.currentTarget.value = ''; }} /></Overlay>}
    {editor && <button className="ig-editor-fab" onClick={() => setModal('settings')}><Settings2 size={18} /> Gérer</button>}
  </div>;
}

function ProfileView({ profile, profiles, posts, highlights, editor, onBack, onEdit, onPost, onProfile, onHashtag, onFollow }: { profile: InstagramProfile; profiles: InstagramProfile[]; posts: InstagramPost[]; highlights: Array<{ id: string; title: string; cover: string }>; editor: boolean; onBack: () => void; onEdit: () => void; onPost: (post: InstagramPost) => void; onProfile: (id: string) => void; onHashtag: (tag: string) => void; onFollow: () => void }) {
  return <section className="ig-profile">
    <div className="ig-profile-top"><button className="ig-back" onClick={onBack} aria-label="Retour"><ArrowLeft size={26} /></button><h1>{profile.username}</h1>{profile.verified && <BadgeCheck size={20} fill="#0095f6" color="#fff" />}</div>
    <div className="ig-profile-header"><Avatar profile={profile} size={88} /><div className="ig-profile-metrics"><span><b>{posts.length}</b> publications</span><span><b>{number(profile.followers)}</b> abonnés</span><span><b>{number(profile.following)}</b> abonnements</span></div></div>
    <div className="ig-profile-bio"><b>{profile.displayName}</b><small>{profile.category}</small><p><RichText text={profile.bio} profiles={profiles} onProfile={onProfile} onHashtag={onHashtag} /></p>{profile.link && <a href={profile.link} target="_blank" rel="noreferrer">{profile.link}</a>}</div>
    <div className="ig-profile-actions">{editor ? <button className="ig-secondary" onClick={onEdit}>Éditer le profil</button> : <button className={profile.followingByViewer ? 'ig-secondary' : 'ig-primary'} onClick={onFollow}>{profile.followingByViewer ? 'Abonné(e)' : 'Suivre'}</button>}<button className="ig-secondary"><Share2 size={17} /></button></div>
    {highlights.length > 0 && <div className="ig-highlights">{highlights.map(highlight => <div key={highlight.id}><img src={mediaUrl(highlight.cover)} alt="" /><span>{highlight.title}</span></div>)}</div>}
    <div className="ig-profile-tabs"><span className="active"><Grid3X3 size={16} /> Publications</span><span><UserRound size={16} /> Identifié(e)</span></div>
    <div className="ig-profile-grid">{posts.map(post => <button onClick={() => onPost(post)} key={post.id}><img src={mediaUrl(post.media[0] || 'Instagram.png')} alt="" /><span><Heart fill="currentColor" size={16} /> {number(post.likes)}</span></button>)}</div>
  </section>;
}

function InstagramSettings({ database, onExport, onImport, onToggleStory, onCreateHighlight }: {
  database: InstagramDatabase; onExport: () => void; onImport: () => void; onToggleStory: (storyId: string) => void; onCreateHighlight: (storyId: string, title: string) => void;
}) {
  const [highlightStoryId, setHighlightStoryId] = useState(database.stories[0]?.id ?? '');
  const [highlightTitle, setHighlightTitle] = useState('');
  const profiles = new Map(database.profiles.map(profile => [profile.id, profile]));
  return <div className="ig-settings">
    <p>Les publications et images importées restent enregistrées dans ce navigateur. Les fichiers importés sont stockés séparément et liés à leurs publications.</p>
    <button className="ig-primary" onClick={onExport}><Download size={17} /> Exporter la sauvegarde</button>
    <button className="ig-secondary" onClick={onImport}><Download size={17} /> Importer une sauvegarde</button>
    <div className="ig-manager-section"><h3>Stories</h3>{database.stories.length === 0 ? <p>Aucune story à gérer.</p> : database.stories.map(story => <div className="ig-story-manage" key={story.id}><img src={mediaUrl(story.media)} alt="" /><span><b>{profiles.get(story.authorId)?.displayName ?? 'Compte'}</b><small>{story.active ? 'Active' : 'Inactive'}</small></span><button className="ig-secondary" onClick={() => onToggleStory(story.id)}>{story.active ? 'Désactiver' : 'Activer'}</button></div>)}</div>
    {database.stories.length > 0 && <form className="ig-highlight-form" onSubmit={event => { event.preventDefault(); if (highlightStoryId && highlightTitle.trim()) { onCreateHighlight(highlightStoryId, highlightTitle.trim()); setHighlightTitle(''); } }}><h3>Ajouter à la une</h3><select value={highlightStoryId} onChange={event => setHighlightStoryId(event.target.value)}>{database.stories.map(story => <option value={story.id} key={story.id}>{profiles.get(story.authorId)?.displayName ?? 'Compte'} · {story.active ? 'active' : 'inactive'}</option>)}</select><input value={highlightTitle} onChange={event => setHighlightTitle(event.target.value)} placeholder="Titre de la story à la une" /><button className="ig-secondary">Créer une story à la une</button></form>}
  </div>;
}

function CreatePostModal({ profiles, hashtags, onClose, onUploadImage, onCreate }: { profiles: InstagramProfile[]; hashtags: string[]; onClose: () => void; onUploadImage: (file: File) => Promise<string>; onCreate: (value: { authorId: string; media: string[]; ratio: InstagramRatio; caption: string; context: string; location: string }) => void }) {
  const [authorId, setAuthorId] = useState(profiles[0]?.id ?? '');
  const [media, setMedia] = useState('');
  const [caption, setCaption] = useState('');
  const [context, setContext] = useState('');
  const [tone, setTone] = useState<InstagramTone>('célébration');
  const [location, setLocation] = useState('');
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const generate = async () => { const author = profiles.find(profile => profile.id === authorId); if (!author) return; setGenerating(true); setCaption(await generateInstagramCaption(author, context, tone)); setGenerating(false); };
   return <Overlay title="Créer une publication" onClose={onClose}><form className="ig-form" onSubmit={event => { event.preventDefault(); const files = media.split(',').map(item => item.trim()).filter(Boolean); if (authorId && files.length && caption.trim()) onCreate({ authorId, media: files, ratio: files.length > 1 ? 'portrait' : 'square', caption: caption.trim(), context: context.trim(), location: location.trim() }); }}>
     <label>Auteur<ProfileSearchField profiles={profiles} value={authorId} onChange={setAuthorId} placeholder="Rechercher par nom ou pseudo…" ariaLabel="Rechercher l’auteur de la publication" /></label>
    <label>Photos
      {media && <div className="ig-upload-preview">{media.split(',').map(item => item.trim()).filter(Boolean).map(item => <img key={item} src={mediaUrl(item)} alt="" />)}</div>}
      <input type="file" accept=".jpg,.jpeg,.png,.webp,.svg,image/*" multiple disabled={uploading} onChange={async event => {
       const inputElement = event.currentTarget;
       const files = [...(inputElement.files ?? [])];
      if (!files.length) return;
      setUploading(true);
      try {
        const ids = await Promise.all(files.map(file => onUploadImage(file)));
        setMedia(ids.join(', '));
      } catch (error) {
        console.error('[Instagram] Échec de l’import des photos :', error);
      } finally {
        setUploading(false);
        if (inputElement) inputElement.value = '';
      }
      }} />
      <small>{uploading ? 'Import en cours…' : 'Importer une photo depuis mon ordinateur. Si plusieurs photos sont sélectionnées, le mode carrousel s’active automatiquement.'}</small>
    </label>
    <small>{media.split(',').filter(Boolean).length > 1 ? 'Carrousel : les images seront harmonisées au format 4:5.' : 'Une photo seule conservera ses proportions originales.'}</small>
    <label>Contexte pour l’IA<input value={context} onChange={event => setContext(event.target.value)} placeholder="Match, événement, émotion…" /></label>
    <div className="ig-ai-row"><select value={tone} onChange={event => setTone(event.target.value as InstagramTone)}>{(['célébration', 'défaite', 'clash', 'romance', 'officiel'] as InstagramTone[]).map(item => <option key={item}>{item}</option>)}</select><button type="button" onClick={generate} disabled={generating} className="ig-secondary"><Sparkles size={16} /> {generating ? 'Création…' : 'Légende IA'}</button></div>
    <label>Légende<AutocompleteField value={caption} onChange={setCaption} profiles={profiles} hashtags={hashtags} multiline rows={4} placeholder="Écrivez une légende ou générez-la avec l’IA." ariaLabel="Légende de la publication" /></label>
    <label>Lieu <input value={location} onChange={event => setLocation(event.target.value)} placeholder="Caledora City" /></label>
     <button className="ig-primary" disabled={!authorId || !caption.trim()}>Partager</button>
  </form></Overlay>;
}

function EditPostModal({ post, profiles, hashtags, onClose, onSave, onDelete }: { post: InstagramPost; profiles: InstagramProfile[]; hashtags: string[]; onClose: () => void; onSave: (patch: Partial<InstagramPost>) => void; onDelete: () => void }) {
  const [caption, setCaption] = useState(post.caption);
  const [context, setContext] = useState(post.context ?? '');
  const [location, setLocation] = useState(post.location ?? '');
  const [tags, setTags] = useState((post.tags ?? []).join(', '));
  return <Overlay title="Modifier la publication" onClose={onClose}><form className="ig-form" onSubmit={event => {
    event.preventDefault();
    const cleanTags = [...new Set(tags.split(',').map(tag => tag.trim().replace(/^#/, '').replace(/[^\p{L}0-9_]/gu, '')).filter(Boolean))].slice(0, 15);
    onSave({ caption: caption.trim(), context: context.trim() || undefined, location: location.trim() || undefined, tags: cleanTags });
  }}>
    <label>Légende<AutocompleteField value={caption} onChange={setCaption} profiles={profiles} hashtags={hashtags} multiline rows={5} ariaLabel="Modifier la légende" /></label>
    <label>Contexte pour l’IA<textarea value={context} onChange={event => setContext(event.target.value)} placeholder="Comptes, pays ou registre de réactions souhaités." /></label>
    <label>Lieu<input value={location} onChange={event => setLocation(event.target.value)} placeholder="Caledora City" /></label>
    <label>Tags <input value={tags} onChange={event => setTags(event.target.value)} placeholder="football, Caledora, matchday" /><small>Séparez les tags par des virgules.</small></label>
    <div className="ig-form-actions"><button className="ig-primary" disabled={!caption.trim()}>Enregistrer</button><button type="button" className="ig-danger" onClick={onDelete}>Supprimer la publication</button></div>
  </form></Overlay>;
}

function CreateStoryModal({ profiles, onClose, onUploadImage, onCreate }: { profiles: InstagramProfile[]; onClose: () => void; onUploadImage: (file: File) => Promise<string>; onCreate: (story: InstagramStory) => void }) {
  const [authorId, setAuthorId] = useState(profiles[0]?.id ?? '');
  const [media, setMedia] = useState('caledora-street.svg');
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState(() => getUploadedMedia().map(item => item.path));
  return <Overlay title="Créer une story" onClose={onClose}><form className="ig-form" onSubmit={event => { event.preventDefault(); if (authorId && media) onCreate({ id: `ig-story-${Date.now()}`, authorId, media, text: text.trim() || undefined, active: true, createdAt: Date.now() }); }}>
    <label>Auteur<select value={authorId} onChange={event => setAuthorId(event.target.value)}>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select></label>
    <label>Média local<select value={availableMedia.includes(media) || uploadedMedia.includes(media) ? media : ''} onChange={event => setMedia(event.target.value)}><option value="">Choisir un média…</option>{availableMedia.map(item => <option key={item}>{item}</option>)}{uploadedMedia.map(item => <option key={item} value={item}>Médiathèque · {item.split('/').pop()}</option>)}</select><input type="file" accept="image/*" disabled={uploading} onChange={async event => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { const path = await onUploadImage(file); setMedia(path); setUploadedMedia(current => [...new Set([...current, path])]); } catch { /* Parent reports upload errors. */ } finally { setUploading(false); event.currentTarget.value = ''; } }} /><small>{uploading ? 'Import en cours…' : 'Importer depuis mon ordinateur'}</small></label>
    <label>Texte <input value={text} onChange={event => setText(event.target.value)} placeholder="Une phrase pour votre story" /></label>
    <button className="ig-primary">Publier la story</button>
  </form></Overlay>;
}

function EditProfileModal({ profile, profiles, onClose, onUploadImage, onSave }: { profile: InstagramProfile; profiles: InstagramProfile[]; onClose: () => void; onUploadImage: (file: File) => Promise<string>; onSave: (profile: InstagramProfile) => void }) {
  const [draft, setDraft] = useState(profile);
  const [relationProfileId, setRelationProfileId] = useState('');
  const [relationType, setRelationType] = useState<InstagramProfile['relations'][number]['type']>('coéquipier');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState('');
  const otherProfiles = profiles.filter(item => item.id !== profile.id);
  const update = <K extends keyof InstagramProfile>(key: K, value: InstagramProfile[K]) => setDraft(current => ({ ...current, [key]: value }));
  const addRelation = () => {
    if (!relationProfileId) return;
    update('relations', [...draft.relations.filter(item => item.profileId !== relationProfileId), { profileId: relationProfileId, type: relationType }]);
    setRelationProfileId('');
  };
  return <Overlay title="Éditer le profil" onClose={onClose}><form className="ig-form" onSubmit={event => { event.preventDefault(); onSave(draft); }}>
    <label>Nom affiché<input value={draft.displayName} onChange={event => update('displayName', event.target.value)} /></label>
    <label>Pseudo<input value={draft.username} onChange={event => update('username', event.target.value.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9._]/g, ''))} /></label>
    <label>Type de compte<select value={draft.accountType} onChange={event => update('accountType', event.target.value as InstagramProfile['accountType'])}>{instagramAccountTypes.map(item => <option key={item}>{item}</option>)}</select></label>
    <label>Catégorie<input value={draft.category} onChange={event => update('category', event.target.value)} /></label>
     <div className="ig-form-two"><label>Nombre d’abonnés<input type="number" min="0" step="1" inputMode="numeric" value={draft.followers} onChange={event => update('followers', Math.max(0, Number.parseInt(event.target.value, 10) || 0))} /></label><label>Nombre d’abonnements<input type="number" min="0" step="1" inputMode="numeric" value={draft.following} onChange={event => update('following', Math.max(0, Number.parseInt(event.target.value, 10) || 0))} /></label></div>
    <div className="grid gap-2"><label>Photo de profil<input value={draft.avatar} onChange={event => update('avatar', event.target.value)} /></label><label className={`flex cursor-pointer items-center justify-center rounded border border-dashed border-primary/40 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 ${avatarUploading ? 'pointer-events-none opacity-60' : ''}`}><Upload size={13} className="mr-1" />{avatarUploading ? 'Import en cours…' : 'Importer depuis mon ordinateur'}<input type="file" accept=".jpg,.jpeg,.png,.webp,.svg,image/*" className="hidden" disabled={avatarUploading} onChange={async event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (!file) return; setAvatarUploading(true); setAvatarUploadError(''); try { update('avatar', await onUploadImage(file)); } catch (error) { setAvatarUploadError(error instanceof Error ? error.message : 'Import impossible.'); } finally { setAvatarUploading(false); } }} /></label>{avatarUploadError && <small className="text-destructive">{avatarUploadError}</small>}</div>
    <label>Bio<AutocompleteField value={draft.bio} onChange={value => update('bio', value)} profiles={profiles} multiline rows={3} ariaLabel="Bio du profil" /></label>
    <label>Lien<input value={draft.link ?? ''} onChange={event => update('link', event.target.value)} /></label>
    {isOrganisation(draft.accountType) ? <div className="ig-form-two"><label>Ton de communication<select value={draft.communicationTone} onChange={event => update('communicationTone', event.target.value as InstagramProfile['communicationTone'])}>{instagramCommunicationTones.map(item => <option key={item}>{item}</option>)}</select></label><label>Statut<select value={draft.status} onChange={event => update('status', event.target.value as InstagramProfile['status'])}>{instagramStatuses.map(item => <option key={item}>{item}</option>)}</select></label></div> : <div className="ig-form-two"><label>Réputation<select value={draft.reputation} onChange={event => update('reputation', event.target.value as InstagramProfile['reputation'])}>{instagramReputations.map(item => <option key={item}>{item}</option>)}</select></label><label>Personnalité<select value={draft.personality} onChange={event => update('personality', event.target.value as InstagramProfile['personality'])}>{instagramPersonalities.map(item => <option key={item}>{item}</option>)}</select></label></div>}
    <label className="ig-check"><input type="checkbox" checked={draft.verified} onChange={event => update('verified', event.target.checked)} /> Compte certifié</label>
     <div className="ig-relation-editor"><b>Relations</b><div><ProfileSearchField profiles={otherProfiles} value={relationProfileId} onChange={setRelationProfileId} placeholder="Rechercher par nom ou pseudo…" ariaLabel="Rechercher un compte à relier" /><select value={relationType} onChange={event => setRelationType(event.target.value as InstagramProfile['relations'][number]['type'])}>{instagramRelationTypes.map(item => <option key={item}>{item}</option>)}</select><button type="button" className="ig-secondary" onClick={addRelation} disabled={!relationProfileId}>+ Ajouter le lien</button></div></div>
    {draft.relations.length > 0 && <div className="ig-relation-list">{draft.relations.map(item => <span key={item.profileId}>{otherProfiles.find(profile => profile.id === item.profileId)?.displayName ?? 'Compte'} · {item.type}<button type="button" onClick={() => update('relations', draft.relations.filter(relation => relation.profileId !== item.profileId))}><X size={12} /></button></span>)}</div>}
    <button className="ig-primary">Enregistrer</button>
  </form></Overlay>;
}