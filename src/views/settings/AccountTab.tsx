import { useState, type FormEvent } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { useAuth } from '../../auth/AuthProvider';
import { useAppState, type Density, type Theme } from '../../shell/AppState';
import { inputStyle } from './shared';

/** Account settings: display name (auth user_metadata + profiles row, the
 * sources the Sidebar/Overview greeting read), password change, and the
 * instant local appearance toggles (theme / density). Email is shown
 * read-only — changing it needs a confirmation round-trip we haven't built. */
export function AccountTab() {
  const auth = useAuth();
  const { state, set } = useAppState();

  const currentName =
    (typeof auth.user?.user_metadata?.display_name === 'string'
      ? auth.user.user_metadata.display_name
      : null) ?? '';

  const [name, setName] = useState(currentName);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !auth.user) {
      setNameMsg({ kind: 'err', text: 'Sign in to change your name.' });
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setNameMsg({ kind: 'err', text: 'Name can’t be empty.' });
      return;
    }
    setSavingName(true);
    setNameMsg(null);
    // user_metadata is what the shell reads; the profiles row keeps the
    // relational copy in sync (self-upsert is allowed by RLS).
    const { error } = await supabase.auth.updateUser({
      data: { display_name: trimmed },
    });
    if (!error) {
      await supabase
        .from('profiles')
        .upsert({ id: auth.user.id, display_name: trimmed }, { onConflict: 'id' });
    }
    setSavingName(false);
    setNameMsg(
      error
        ? { kind: 'err', text: error.message }
        : { kind: 'ok', text: 'Name updated.' },
    );
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !auth.user) {
      setPwMsg({ kind: 'err', text: 'Sign in to change your password.' });
      return;
    }
    if (pw.length < 8) {
      setPwMsg({ kind: 'err', text: 'Use at least 8 characters.' });
      return;
    }
    if (pw !== pw2) {
      setPwMsg({ kind: 'err', text: 'Passwords don’t match.' });
      return;
    }
    setSavingPw(true);
    setPwMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSavingPw(false);
    if (error) {
      setPwMsg({ kind: 'err', text: error.message });
      return;
    }
    setPw('');
    setPw2('');
    setPwMsg({ kind: 'ok', text: 'Password changed.' });
  }

  return (
    <div className="stack gap-16">
      <form onSubmit={saveName} className="card card-pad stack gap-10">
        <span className="h2">Profile</span>
        <label className="stack gap-4">
          <span className="meta">Display name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={inputStyle}
            disabled={savingName}
          />
        </label>
        <label className="stack gap-4">
          <span className="meta">Email (sign-in identity — not editable here yet)</span>
          <input
            type="text"
            value={auth.user?.email ?? ''}
            readOnly
            disabled
            style={{ ...inputStyle, opacity: 0.6 }}
          />
        </label>
        {nameMsg && <Msg msg={nameMsg} />}
        <div>
          <button type="submit" className="btn primary sm" disabled={savingName}>
            {savingName ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      <form onSubmit={savePassword} className="card card-pad stack gap-10">
        <span className="h2">Password</span>
        <label className="stack gap-4">
          <span className="meta">New password</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            style={inputStyle}
            disabled={savingPw}
          />
        </label>
        <label className="stack gap-4">
          <span className="meta">Confirm new password</span>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
            style={inputStyle}
            disabled={savingPw}
          />
        </label>
        {pwMsg && <Msg msg={pwMsg} />}
        <div>
          <button type="submit" className="btn primary sm" disabled={savingPw}>
            {savingPw ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>

      <div className="card card-pad stack gap-10">
        <span className="h2">Appearance</span>
        <div className="row between">
          <span className="meta">Theme</span>
          <div className="seg">
            {(['dark', 'light'] as Theme[]).map((t) => (
              <button
                key={t}
                className={state.theme === t ? 'on' : ''}
                onClick={() => set({ theme: t })}
                style={{ textTransform: 'capitalize' }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="row between">
          <span className="meta">Density</span>
          <div className="seg">
            {(['comfortable', 'compact'] as Density[]).map((d) => (
              <button
                key={d}
                className={state.density === d ? 'on' : ''}
                onClick={() => set({ density: d })}
                style={{ textTransform: 'capitalize' }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <span className="meta" style={{ fontSize: 11 }}>
          Saved on this device (applies immediately).
        </span>
      </div>
    </div>
  );
}

function Msg({ msg }: { msg: { kind: 'ok' | 'err'; text: string } }) {
  return (
    <div
      className="meta"
      style={{
        color: msg.kind === 'err' ? 'var(--danger, #c33)' : 'var(--accent)',
        fontSize: 12,
      }}
    >
      {msg.kind === 'err' ? '⚠ ' : '✓ '}
      {msg.text}
    </div>
  );
}
