import { useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, FileArchive, HardDriveUpload, Image, Upload, XCircle } from 'lucide-react';
import { Link } from 'wouter';
import {
  createGlobalBackup,
  downloadGlobalBackup,
  importGlobalBackup,
  isBackupFileSizeValid,
  type BackupImportResult,
} from '@/services/globalBackup';

type Notice = { kind: 'success' | 'error'; message: string } | null;

function summary(result: BackupImportResult) {
  if (result.legacy) return `${result.pages} article${result.pages > 1 ? 's' : ''} restauré${result.pages > 1 ? 's' : ''}. Les autres modules n’ont pas été modifiés.`;
  const core = `${result.pages} article${result.pages > 1 ? 's' : ''}, ${result.profiles} profil${result.profiles > 1 ? 's' : ''}, ${result.posts} publication${result.posts > 1 ? 's' : ''} et ${result.tweets} post${result.tweets > 1 ? 's' : ''} X restaurés.`;
  const conflicts = result.conflicts ? ` ${result.conflicts} élément${result.conflicts > 1 ? 's' : ''} portant le même identifiant ${result.conflicts > 1 ? 'ont' : 'a'} été mis à jour depuis la sauvegarde.` : '';
  const media = result.restoredMedia ? ` ${result.restoredMedia} image${result.restoredMedia > 1 ? 's' : ''} réhydratée${result.restoredMedia > 1 ? 's' : ''}.` : '';
  const skipped = result.skippedMedia ? ` ${result.skippedMedia} image${result.skippedMedia > 1 ? 's' : ''} n’a${result.skippedMedia > 1 ? 'ont' : ''} pas pu être récupérée${result.skippedMedia > 1 ? 's' : ''}.` : '';
  return `${core}${conflicts}${media}${skipped}`;
}

export function GlobalBackupPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const exportAll = async () => {
    setBusy('export');
    setNotice(null);
    try {
      const result = await createGlobalBackup();
      downloadGlobalBackup(result.backup);
      setNotice({
        kind: 'success',
        message: `Sauvegarde téléchargée. ${result.backup.media.length} image${result.backup.media.length > 1 ? 's' : ''} incluse${result.backup.media.length > 1 ? 's' : ''}${result.skippedMedia ? ` · ${result.skippedMedia} image${result.skippedMedia > 1 ? 's' : ''} non disponible${result.skippedMedia > 1 ? 's' : ''}` : ''}.`,
      });
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : 'La sauvegarde n’a pas pu être créée.' });
    } finally {
      setBusy(null);
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setBusy('import');
    setNotice(null);
    try {
      if (!isBackupFileSizeValid(file.size)) throw new Error('Cette sauvegarde dépasse la limite de 60 Mo.');
      let value: unknown;
      try {
        value = JSON.parse(await file.text());
      } catch {
        throw new Error('Ce fichier JSON est malformé et ne peut pas être restauré.');
      }
      const result = await importGlobalBackup(value);
      setNotice({ kind: 'success', message: summary(result) });
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : 'Le fichier n’est pas valide.' });
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return <section className="animate-rise mx-auto max-w-3xl px-4 py-8 sm:py-12">
    <Link href="/" className="wiki-link inline-flex items-center gap-1.5 text-sm"><ArrowLeft size={15} /> Retour au Hub</Link>
    <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--wiki-border)] bg-white shadow-sm dark:border-border dark:bg-card">
      <div className="bg-gradient-to-br from-[#0c1c38] to-[#16345f] px-6 py-8 text-white sm:px-9">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/12"><FileArchive size={23} /></div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">CaledoraOS</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Import / Export Global</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">Une sauvegarde unique pour WikiBase, Instagram, Twitter/X, les profils, relations, publications et les images que vous avez importées.</p>
      </div>

      <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-9">
        <article className="rounded-xl border border-[var(--wiki-border)] bg-[#f8f9fa] p-5 dark:border-border dark:bg-secondary">
          <div className="flex items-center gap-2 text-primary"><Download size={19} /><h2 className="font-bold">Exporter tout</h2></div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Créez un fichier JSON portable. Les images locales sont encodées dans la sauvegarde afin de suivre vos données sur une autre machine.</p>
          <button onClick={() => void exportAll()} disabled={busy !== null} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-55">
            <Download size={16} /> {busy === 'export' ? 'Préparation de la sauvegarde…' : 'Exporter la sauvegarde globale'}
          </button>
        </article>

        <article className="rounded-xl border border-[var(--wiki-border)] bg-[#f8f9fa] p-5 dark:border-border dark:bg-secondary">
          <div className="flex items-center gap-2 text-primary"><HardDriveUpload size={19} /><h2 className="font-bold">Restaurer un univers</h2></div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Importez une sauvegarde CaledoraOS. Les données sont fusionnées par identifiant : aucun élément présent sur cet appareil n’est effacé silencieusement. En cas de conflit, la version de la sauvegarde met à jour l’élément local.</p>
          <button onClick={() => inputRef.current?.click()} disabled={busy !== null} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-white px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/5 disabled:opacity-55 dark:bg-card">
            <Upload size={16} /> {busy === 'import' ? 'Restauration en cours…' : 'Importer une sauvegarde'}
          </button>
          <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={event => void importFile(event.target.files?.[0])} />
        </article>
      </div>

      <div className="border-t border-[var(--wiki-border)] px-6 py-5 dark:border-border sm:px-9">
        {notice && <div role="status" className={`flex gap-2 rounded-lg px-4 py-3 text-sm ${notice.kind === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'}`}>
          {notice.kind === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <XCircle size={18} className="mt-0.5 shrink-0" />}
          <span>{notice.message}</span>
        </div>}
        <div className="mt-1 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Image size={15} className="mt-0.5 shrink-0" />Les images déjà incluses dans l’application restent légères ; seules les images uploadées sont copiées dans le fichier de sauvegarde.</div>
      </div>
    </div>
  </section>;
}