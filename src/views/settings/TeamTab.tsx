import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { inputStyle } from './shared';

/**
 * Settings → team. Roster via the list_workspace_members RPC (members can
 * see the roster; RLS on the raw table stays read-self). Role changes and
 * removals are owner-only RPCs. Invites are by email and accept-on-login:
 * the invitee signs up/in with that address and the app claims the invite
 * automatically (accept_workspace_invites in App.tsx) — no invite links.
 */

interface Member {
  user_id: string;
  role: string;
  display_name: string | null;
  email: string | null;
  is_owner: boolean;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  accepted_at: string | null;
}

export function TeamTab() {
  const workspace = useWorkspace();
  const auth = useAuth();
  const isOwner = !!workspace && workspace.ownerId === auth.user?.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !workspace) return;
      setLoading(true);
      const [membersRes, invitesRes] = await Promise.all([
        supabase.rpc('list_workspace_members', { ws_id: workspace.id }),
        supabase
          .from('workspace_invites')
          .select('id, email, role, created_at, accepted_at')
          .eq('workspace_id', workspace.id)
          .is('accepted_at', null)
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      setMembers((membersRes.data ?? []) as Member[]);
      setInvites((invitesRes.data ?? []) as Invite[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id, bump]);

  if (!workspace) {
    return (
      <div className="card card-pad">
        <span className="meta">Team settings are available in the live app.</span>
      </div>
    );
  }

  const reload = () => setBump((b) => b + 1);

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !workspace) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setBusy('invite');
    setMsg(null);
    const { error } = await supabase.from('workspace_invites').insert({
      workspace_id: workspace.id,
      email,
      role: inviteRole,
      invited_by: auth.user?.id ?? null,
    });
    setBusy(null);
    if (error) {
      setMsg({
        ok: false,
        text: error.message.includes('duplicate')
          ? 'That email already has a pending invite.'
          : error.message.includes('policy')
            ? 'Only the workspace owner can invite.'
            : error.message,
      });
      return;
    }
    setInviteEmail('');
    setMsg({
      ok: true,
      text: `Invited ${email} — they join automatically when they sign in with that address.`,
    });
    reload();
  }

  async function setRole(member: Member, role: string) {
    if (!supabase || !workspace) return;
    setBusy(member.user_id);
    setMsg(null);
    const { error } = await supabase.rpc('set_member_role', {
      ws_id: workspace.id,
      member_id: member.user_id,
      new_role: role,
    });
    setBusy(null);
    if (error) return setMsg({ ok: false, text: error.message });
    reload();
  }

  async function remove(member: Member) {
    if (!supabase || !workspace) return;
    if (!confirm(`Remove ${member.email ?? member.display_name ?? 'this member'} from the workspace?`)) return;
    setBusy(member.user_id);
    setMsg(null);
    const { error } = await supabase.rpc('remove_workspace_member', {
      ws_id: workspace.id,
      member_id: member.user_id,
    });
    setBusy(null);
    if (error) return setMsg({ ok: false, text: error.message });
    reload();
  }

  async function revokeInvite(inv: Invite) {
    if (!supabase) return;
    setBusy(inv.id);
    const { error } = await supabase.from('workspace_invites').delete().eq('id', inv.id);
    setBusy(null);
    if (error) return setMsg({ ok: false, text: error.message });
    reload();
  }

  return (
    <div className="stack gap-16">
      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Members</span>
        </div>
        {loading ? (
          <div className="card-pad">
            <span className="meta">Loading…</span>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                {isOwner && <th></th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    <div className="stack gap-2">
                      <span>{m.display_name ?? m.email ?? m.user_id}</span>
                      {m.display_name && m.email && <span className="meta">{m.email}</span>}
                    </div>
                  </td>
                  <td>
                    {m.is_owner ? (
                      <span className="tag" style={{ color: 'var(--accent)' }}>owner</span>
                    ) : isOwner ? (
                      <select
                        value={m.role}
                        onChange={(e) => setRole(m, e.target.value)}
                        disabled={busy === m.user_id}
                        style={{ ...inputStyle, padding: '4px 8px', appearance: 'auto' }}
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : (
                      <span className="tag">{m.role}</span>
                    )}
                  </td>
                  {isOwner && (
                    <td style={{ textAlign: 'right' }}>
                      {!m.is_owner && (
                        <button className="btn danger sm" disabled={busy === m.user_id} onClick={() => remove(m)}>
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card card-pad stack gap-10">
        <span className="h2">Invite someone</span>
        {isOwner ? (
          <>
            <form className="row gap-8" onSubmit={invite} style={{ flexWrap: 'wrap' }}>
              <input
                type="email"
                required
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                disabled={busy === 'invite'}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                style={{ ...inputStyle, appearance: 'auto' }}
                disabled={busy === 'invite'}
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
              <button type="submit" className="btn primary sm" disabled={busy === 'invite'}>
                {busy === 'invite' ? 'Inviting…' : 'Invite'}
              </button>
            </form>
            <span className="meta" style={{ fontSize: 11 }}>
              No email is sent yet — share the app link yourself. The moment they sign up (or log
              in) with this address, they're added to the workspace automatically.
            </span>
          </>
        ) : (
          <span className="meta">Only the workspace owner can invite members.</span>
        )}
        {invites.length > 0 && (
          <div className="stack gap-6">
            <span className="meta" style={{ fontWeight: 600 }}>Pending invites</span>
            {invites.map((inv) => (
              <div key={inv.id} className="row between">
                <span className="meta">
                  {inv.email} · {inv.role} · invited {new Date(inv.created_at).toLocaleDateString()}
                </span>
                {isOwner && (
                  <button className="btn ghost sm" disabled={busy === inv.id} onClick={() => revokeInvite(inv)}>
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {msg && (
          <span className="meta" style={{ color: msg.ok ? 'var(--accent)' : 'var(--danger, #c33)' }}>
            {msg.ok ? '✓ ' : '⚠ '}
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
