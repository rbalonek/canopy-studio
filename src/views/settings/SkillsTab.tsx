// Settings → Skills: the workspace's prompt-module library.
//
// A skill is a markdown block ("LEARNED GUIDELINE") injected into the
// system prompt of the AI tasks it applies to. The team curates these
// over time (tone rules, industry learnings, podcast takeaways) without
// touching code — an empty applies_to list means "all tasks".

import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { AI_TASKS, inputStyle } from './shared';

type SkillRow = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  applies_to: string[];
  enabled: boolean;
  sort_order: number;
};

export function SkillsTab() {
  const workspace = useWorkspace();
  const [skills, setSkills] = useState<SkillRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refresh() {
    if (!supabase || !workspace) return;
    const { data, error: err } = await supabase
      .from('skills')
      .select('id, name, description, content, applies_to, enabled, sort_order')
      .eq('workspace_id', workspace.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (err) {
      setError(err.message);
      return;
    }
    setSkills((data ?? []) as unknown as SkillRow[]);
  }

  useEffect(() => {
    setSkills(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  async function toggle(skill: SkillRow) {
    if (!supabase) return;
    await supabase
      .from('skills')
      .update({ enabled: !skill.enabled, updated_at: new Date().toISOString() })
      .eq('id', skill.id);
    refresh();
  }

  async function remove(skill: SkillRow) {
    if (!supabase) return;
    if (!confirm(`Delete skill "${skill.name}"?`)) return;
    await supabase.from('skills').delete().eq('id', skill.id);
    refresh();
  }

  if (!workspace) return null;
  if (skills === null) return <div className="meta">Loading…</div>;

  return (
    <div className="stack gap-16">
      <div className="card">
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="stack gap-2">
            <span className="h2">Skills</span>
            <span className="meta">
              Reusable guidelines injected into the AI's instructions. Keep each one focused —
              "How we write CTAs", "Lessons from the Q2 podcast series" — and toggle them on/off
              per experiment.
            </span>
          </div>
          {!adding && (
            <button className="btn primary sm" onClick={() => setAdding(true)}>
              + New skill
            </button>
          )}
        </div>

        {adding && (
          <SkillForm
            workspaceId={workspace.id}
            onDone={() => {
              setAdding(false);
              refresh();
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {skills.length === 0 && !adding && (
          <div className="card-pad meta">No skills yet. Add your first learned guideline.</div>
        )}

        {skills.map((s, i) => (
          <div
            key={s.id}
            className="card-pad stack gap-8"
            style={{ borderBottom: i < skills.length - 1 ? '1px solid var(--border)' : 0 }}
          >
            {editingId === s.id ? (
              <SkillForm
                workspaceId={workspace.id}
                existing={s}
                onDone={() => {
                  setEditingId(null);
                  refresh();
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div className="row between">
                  <div className="stack gap-2">
                    <div className="row gap-8">
                      <span style={{ fontWeight: 500, opacity: s.enabled ? 1 : 0.5 }}>
                        {s.name}
                      </span>
                      {!s.enabled && (
                        <span className="meta" style={{ fontSize: 11 }}>
                          disabled
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <span className="meta" style={{ fontSize: 11 }}>
                        {s.description}
                      </span>
                    )}
                    <span className="meta" style={{ fontSize: 11 }}>
                      Applies to:{' '}
                      {s.applies_to.length === 0
                        ? 'all tasks'
                        : s.applies_to
                            .map((t) => AI_TASKS.find((a) => a.id === t)?.label ?? t)
                            .join(', ')}
                    </span>
                  </div>
                  <div className="row gap-6">
                    <button className="btn sm" onClick={() => setEditingId(s.id)}>
                      Edit
                    </button>
                    <button className="btn sm" onClick={() => toggle(s)}>
                      {s.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button className="btn ghost sm" onClick={() => remove(s)}>
                      Delete
                    </button>
                  </div>
                </div>
                <pre
                  className="meta"
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontSize: 12,
                    margin: 0,
                    maxHeight: 120,
                    overflow: 'auto',
                  }}
                >
                  {s.content}
                </pre>
              </>
            )}
          </div>
        ))}
        {error && (
          <div className="card-pad meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
            ⚠ {error}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillForm({
  workspaceId,
  existing,
  onDone,
  onCancel,
}: {
  workspaceId: string;
  existing?: SkillRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [content, setContent] = useState(existing?.content ?? '');
  const [appliesTo, setAppliesTo] = useState<string[]>(existing?.applies_to ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTask(taskId: string) {
    setAppliesTo((prev) =>
      prev.includes(taskId) ? prev.filter((t) => t !== taskId) : [...prev, taskId],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!name.trim() || !content.trim()) {
      setError('Name and content are required');
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload = {
      workspace_id: workspaceId,
      name: name.trim(),
      description: description.trim() || null,
      content: content.trim(),
      applies_to: appliesTo,
      updated_at: new Date().toISOString(),
    };

    const { error: err } = existing
      ? await supabase.from('skills').update(payload).eq('id', existing.id)
      : await supabase.from('skills').insert(payload);

    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    onDone();
  }

  return (
    <form className="card-pad stack gap-12" onSubmit={onSubmit}>
      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        <label className="stack gap-4" style={{ flex: 1, minWidth: 200 }}>
          <span className="meta">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How we write CTAs"
            style={inputStyle}
            disabled={submitting}
          />
        </label>
        <label className="stack gap-4" style={{ flex: 2, minWidth: 260 }}>
          <span className="meta">Description (optional)</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One line on when this applies"
            style={inputStyle}
            disabled={submitting}
          />
        </label>
      </div>

      <label className="stack gap-4">
        <span className="meta">Guideline content (markdown)</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={'- Lead with the outcome, not the feature\n- Never use exclamation marks'}
          style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
          disabled={submitting}
        />
      </label>

      <div className="stack gap-4">
        <span className="meta">Applies to (none selected = all tasks)</span>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {AI_TASKS.map((t) => (
            <label key={t.id} className="row gap-4" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={appliesTo.includes(t.id)}
                onChange={() => toggleTask(t.id)}
                disabled={submitting}
              />
              <span className="meta">{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
          ⚠ {error}
        </div>
      )}

      <div className="row gap-6">
        <button type="submit" className="btn primary sm" disabled={submitting}>
          {submitting ? 'Saving…' : existing ? 'Save changes' : 'Add skill'}
        </button>
        <button type="button" className="btn ghost sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
