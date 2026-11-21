import { Check, Code2, Copy, Download, ExternalLink, Globe2, KeyRound, Link2, Lock, QrCode, Timer } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState, type ReactNode } from 'react';
import { Badge, Button, CommitInput, Field, Panel, Section, Select, Toggle, inputCls } from '../../components/common/ui';
import { PROJECT_TYPES } from '../../lib/defaultProject';
import { api } from '../../services/api';
import { useEditor } from '../../store/editor';
import type { ProjectDoc, ProjectType } from '../../types';

export const tourLink = (id: string, embed = false) => `${location.origin}${location.pathname}#/visite/${encodeURIComponent(id)}${embed ? '?embed=1' : ''}`;

function CopyField({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly aria-label={label} value={value} className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.target.select()} />
      <Button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {
            prompt(label, value);
          }
        }}
      >
        {done ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} {done ? 'Copié' : 'Copier'}
      </Button>
    </div>
  );
}

/** Share settings are server-owned: applied immediately (not part of undo/save). */
async function updateShare(id: string, patch: { visibility?: 'unlisted' | 'public'; password?: string | null; expiresAt?: string | null }) {
  const st = useEditor.getState();
  try {
    const r = await api<ProjectDoc>(`/api/projects/${id}/publication`, { method: 'PATCH', body: patch });
    const p = useEditor.getState().project;
    if (p) useEditor.setState({ project: { ...p, visibility: r.visibility, share: r.share } });
    st.toast({ kind: 'success', text: 'Paramètres de partage mis à jour.' });
    return true;
  } catch (e) {
    st.toast({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Panel className="p-4">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <span className="text-cyan">{icon}</span> {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </Panel>
  );
}

export function SettingsModule() {
  const p = useEditor((s) => s.project);
  const dirty = useEditor((s) => s.dirty);
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState('');
  const [qr, setQr] = useState<string>();
  const [width, setWidth] = useState('100%');
  const published = p?.status === 'published';

  useEffect(() => {
    if (!p || !published) return setQr(undefined);
    QRCode.toDataURL(tourLink(p.id), { width: 512, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#101827', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(undefined));
  }, [p?.id, published]);

  if (!p) return null;
  const share = p.share;
  const embed = `<iframe src="${tourLink(p.id, true)}" width="${width}" height="560" style="border:0;border-radius:12px" allow="fullscreen; xr-spatial-tracking" allowfullscreen loading="lazy" title="${p.name.replace(/"/g, '&quot;')}"></iframe>`;

  return (
    <div className="h-full overflow-y-auto pb-6">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
        <Card title="Projet" icon={<Globe2 size={17} />}>
          <Field label="Nom de la visite">
            <CommitInput value={p.name} maxLength={120} aria-label="Nom de la visite" onCommit={(v) => useEditor.getState().renameProject(v)} />
          </Field>
          <Field label="Type de lieu">
            <Select<ProjectType>
              label="Type de lieu"
              value={p.type ?? 'other'}
              onChange={(type) => useEditor.getState().apply('Changer le type', (d) => ({ ...d, type }))}
              options={PROJECT_TYPES.map((t) => ({ value: t.id, label: t.label }))}
            />
          </Field>
          <Field label="Description (affichée dans la galerie)">
            <CommitInput multiline value={p.description ?? ''} aria-label="Description de la visite" onCommit={(v) => useEditor.getState().apply('Modifier la description', (d) => ({ ...d, description: v.trim() || undefined }))} />
          </Field>
          <Field label="Sauvegarde automatique">
            <Select
              label="Sauvegarde automatique"
              value={String(p.settings.autosaveSeconds)}
              onChange={(v) => useEditor.getState().setAutosave(Number(v))}
              options={[
                { value: '0', label: 'Désactivée' },
                { value: '30', label: 'Toutes les 30 s' },
                { value: '120', label: 'Toutes les 2 min' },
              ]}
            />
          </Field>
        </Card>

        <Card title="Publication et partage" icon={<Link2 size={17} />}>
          {!published ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-muted">La visite n’est pas publiée : aucun lien de partage n’existe encore.</p>
              <Button variant="primary" onClick={() => void useEditor.getState().publish()}>
                Publier la visite
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={p.publishedRevision === p.revision && !dirty ? 'green' : 'amber'}>{p.publishedRevision === p.revision && !dirty ? 'Version publiée à jour' : 'Modifications non publiées'}</Badge>
                {share?.protected && (
                  <Badge tone="violet">
                    <Lock size={10} /> Mot de passe
                  </Badge>
                )}
                {share?.expiresAt && (
                  <Badge tone="amber">
                    <Timer size={10} /> Expire le {new Date(share.expiresAt).toLocaleString('fr-FR')}
                  </Badge>
                )}
              </div>
              <Field group label="Lien de la visite">
                <CopyField value={tourLink(p.id)} label="Lien de la visite" />
              </Field>
              <a href={tourLink(p.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan hover:underline">
                <ExternalLink size={13} /> Ouvrir dans un nouvel onglet
              </a>
              <Toggle
                label="Visible dans la galerie publique"
                hint={share?.protected ? 'Une visite protégée n’apparaît jamais dans la galerie' : 'Sinon accessible uniquement par lien'}
                checked={p.visibility === 'public'}
                onChange={(v) => void updateShare(p.id, { visibility: v ? 'public' : 'unlisted' })}
              />
              <Section title="Mot de passe">
                {share?.protected ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm text-ink">
                      <KeyRound size={14} className="text-violet-400" /> Protégée
                    </span>
                    <Button size="sm" variant="danger" onClick={() => void updateShare(p.id, { password: null })}>
                      Retirer le mot de passe
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted">Sans mot de passe, toute personne disposant du lien peut visiter.</p>
                )}
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (password.length >= 4 && (await updateShare(p.id, { password }))) setPassword('');
                  }}
                >
                  <input type="password" autoComplete="new-password" aria-label="Nouveau mot de passe" placeholder={share?.protected ? 'Nouveau mot de passe' : 'Définir un mot de passe (4 caractères min.)'} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                  <Button type="submit" disabled={password.length < 4}>
                    {share?.protected ? 'Changer' : 'Protéger'}
                  </Button>
                </form>
                {share?.protected && <p className="text-[11px] text-ink-faint">Changer le mot de passe déconnecte les visiteurs déjà entrés.</p>}
              </Section>
              <Section title="Expiration du lien">
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (expiry && (await updateShare(p.id, { expiresAt: new Date(expiry).toISOString() }))) setExpiry('');
                  }}
                >
                  <input type="datetime-local" aria-label="Date d’expiration" min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputCls} />
                  <Button type="submit" disabled={!expiry}>
                    Appliquer
                  </Button>
                </form>
                {share?.expiresAt && (
                  <Button size="sm" variant="ghost" onClick={() => void updateShare(p.id, { expiresAt: null })}>
                    Supprimer l’expiration
                  </Button>
                )}
              </Section>
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await useEditor.getState().confirm({ title: 'Dépublier la visite ?', message: 'Le lien, l’intégration et le QR code cesseront de fonctionner. Le projet est conservé.', confirmLabel: 'Dépublier', danger: true });
                  if (!ok) return;
                  const r = await api<ProjectDoc>(`/api/projects/${p.id}/unpublish`, { method: 'POST' }).catch((e) => (useEditor.getState().toast({ kind: 'error', text: String(e.message ?? e) }), null));
                  if (r) useEditor.setState({ project: { ...useEditor.getState().project!, status: r.status, publishedRevision: undefined, publishedAt: undefined, visibility: undefined, share: undefined } });
                }}
              >
                Dépublier
              </Button>
            </>
          )}
        </Card>

        <Card title="Intégration sur un site web" icon={<Code2 size={17} />}>
          {published ? (
            <>
              <p className="text-xs text-ink-muted">Collez ce code dans votre site : la visite s’affiche dans un cadre, sans le retour à la galerie.</p>
              <Select label="Largeur" value={width} onChange={setWidth} options={[{ value: '100%', label: 'Largeur : adaptative (100 %)' }, { value: '800', label: 'Largeur : 800 px' }, { value: '640', label: 'Largeur : 640 px' }]} />
              <Field group label="Code d’intégration">
                <CopyField value={embed} label="Code d’intégration" />
              </Field>
              {share?.protected && <p className="text-[11px] text-amber-300">La visite intégrée demandera aussi le mot de passe.</p>}
            </>
          ) : (
            <p className="text-sm text-ink-muted">Disponible une fois la visite publiée.</p>
          )}
        </Card>

        <Card title="QR code" icon={<QrCode size={17} />}>
          {published && qr ? (
            <div className="flex items-center gap-4">
              <img src={qr} alt={`QR code vers la visite ${p.name}`} className="h-40 w-40 rounded-lg bg-white p-1" />
              <div className="space-y-2">
                <p className="text-xs text-ink-muted">Pour vos supports imprimés : il ouvre la visite sur mobile. 512 × 512 px, correction d’erreur moyenne.</p>
                <a href={qr} download={`visite-${p.name.replace(/[^\w-]+/g, '-').toLowerCase()}-qr.png`} className="inline-flex items-center gap-2 rounded-lg bg-cyan px-3 py-2 text-sm font-semibold text-navy-950">
                  <Download size={14} /> Télécharger (PNG)
                </a>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Disponible une fois la visite publiée.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
