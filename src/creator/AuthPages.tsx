import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { navigate } from '../router';
import { ApiError } from '../services/api';
import { useSession } from '../store/session';
import { VisoraMark } from './CreatorLayout';

const input =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E8BE0] focus:outline-none focus:ring-2 focus:ring-[#36C8F4]/40 aria-[invalid=true]:border-red-400';

function Shell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F3F6FB]">
      <aside className="relative hidden w-[44%] max-w-[620px] overflow-hidden bg-[#0A1230] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(700px_380px_at_20%_110%,rgba(120,104,245,.5),transparent_60%),radial-gradient(600px_300px_at_80%_-10%,rgba(54,200,244,.35),transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <VisoraMark />
          <span>
            <span className="block text-2xl font-bold tracking-wide">VISORA</span>
            <span className="block text-xs text-slate-300">Explore spaces. From anywhere.</span>
          </span>
        </div>
        <div className="relative mt-auto">
          <p className="text-3xl font-bold leading-tight">Créez, publiez et partagez des visites immersives.</p>
          <p className="mt-3 max-w-md text-slate-300">Studio 3D, publication en un clic, statistiques d’audience : votre espace de travail VISORA.</p>
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <VisoraMark className="h-9 w-9" />
            <span className="text-xl font-bold text-slate-900">VISORA</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{sub}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="mt-1 text-xs text-red-600">
      {msg}
    </p>
  ) : null;
}

function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className={`${input} pr-10`}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)}
        required
      />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800">
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

const fieldErrors = (e: unknown) => Object.fromEntries((e instanceof ApiError ? e.details ?? [] : []).map((d) => [d.path, d.message]));
const message = (e: unknown) => (e instanceof Error ? e.message : 'Une erreur est survenue.');

export function LoginPage({ next }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await useSession.getState().login(email, password);
      navigate(next ?? '/');
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };

  return (
    <Shell title="Connexion" sub="Accédez à votre espace créateur.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-slate-700">
            E-mail
          </label>
          <input id="login-email" type="email" className={input} value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-slate-700">
            Mot de passe
          </label>
          <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !email || !password} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E8BE0] to-[#36C8F4] py-2.5 text-sm font-semibold text-white shadow disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />} Se connecter
        </button>
        <p className="text-center text-sm text-slate-600">
          Pas encore de compte ?{' '}
          <a href={`#/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-[#1E6FE0] hover:underline">
            Créer un compte
          </a>
        </p>
        <p className="text-center text-xs text-slate-500">La réinitialisation du mot de passe par e-mail n’est pas encore disponible (envoi d’e-mails non configuré).</p>
        <p className="text-center text-sm">
          <a href="#/explorer" className="text-slate-600 hover:underline">
            Explorer les visites publiées sans compte →
          </a>
        </p>
      </form>
    </Shell>
  );
}

export function SignupPage({ next }: { next?: string }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', organizationName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const weak = form.password.length > 0 && form.password.length < 10;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    setFields({});
    try {
      await useSession.getState().signup({ ...form, organizationName: form.organizationName.trim() || undefined });
      navigate(next ?? '/');
    } catch (err) {
      setFields(fieldErrors(err));
      setError(message(err));
      setBusy(false);
    }
  };

  return (
    <Shell title="Créer un compte" sub="Votre organisation est créée avec vous ; vous en êtes le propriétaire.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="su-name" className="mb-1 block text-sm font-medium text-slate-700">
            Nom complet
          </label>
          <input id="su-name" className={input} value={form.name} maxLength={80} autoComplete="name" aria-invalid={!!fields.name} onChange={(e) => set('name')(e.target.value)} required />
          <FieldError id="su-name-err" msg={fields.name} />
        </div>
        <div>
          <label htmlFor="su-email" className="mb-1 block text-sm font-medium text-slate-700">
            E-mail professionnel
          </label>
          <input id="su-email" type="email" className={input} value={form.email} autoComplete="email" aria-invalid={!!fields.email} onChange={(e) => set('email')(e.target.value)} required />
          <FieldError id="su-email-err" msg={fields.email} />
        </div>
        <div>
          <label htmlFor="su-password" className="mb-1 block text-sm font-medium text-slate-700">
            Mot de passe
          </label>
          <PasswordInput id="su-password" value={form.password} onChange={set('password')} autoComplete="new-password" invalid={!!fields.password || weak} />
          <p id="su-password-err" className={`mt-1 text-xs ${weak || fields.password ? 'text-red-600' : 'text-slate-500'}`}>
            {fields.password ?? 'Au moins 10 caractères.'}
          </p>
        </div>
        <div>
          <label htmlFor="su-org" className="mb-1 block text-sm font-medium text-slate-700">
            Organisation <span className="font-normal text-slate-400">(facultatif)</span>
          </label>
          <input id="su-org" className={input} value={form.organizationName} maxLength={80} autoComplete="organization" placeholder="ex. SEHIN GROUP" onChange={(e) => set('organizationName')(e.target.value)} />
        </div>
        {error && !Object.keys(fields).length && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !form.name.trim() || !form.email || form.password.length < 10}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E8BE0] to-[#36C8F4] py-2.5 text-sm font-semibold text-white shadow disabled:opacity-50"
        >
          {busy && <Loader2 size={16} className="animate-spin" />} Créer mon compte
        </button>
        <p className="text-center text-sm text-slate-600">
          Déjà inscrit ?{' '}
          <a href={`#/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-[#1E6FE0] hover:underline">
            Se connecter
          </a>
        </p>
      </form>
    </Shell>
  );
}
