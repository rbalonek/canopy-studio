// Settings → AI: per-task provider/model configuration.
//
// Each AI task (copy generation, website analysis, …) can run on
// Anthropic, OpenAI, or both in collaboration (generate → review →
// refine). Rows live in ai_settings; a task with no row uses the
// built-in default (Anthropic single-provider). Model fields are free
// text so new model IDs never require a deploy.

import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useJobRunner } from '../../data/useJob';
import { AI_TASKS, MODES, PROVIDERS, inputStyle } from './shared';

type TaskSetting = {
  task: string;
  mode: 'anthropic' | 'openai' | 'collaboration';
  primary_provider: 'anthropic' | 'openai';
  primary_model: string;
  reviewer_provider: 'anthropic' | 'openai';
  reviewer_model: string;
};

const DEFAULT_SETTING = (task: string): TaskSetting => ({
  task,
  mode: 'anthropic',
  primary_provider: 'anthropic',
  primary_model: '',
  reviewer_provider: 'openai',
  reviewer_model: '',
});

export function AiSettingsTab() {
  const workspace = useWorkspace();
  const [settings, setSettings] = useState<Record<string, TaskSetting> | null>(null);
  const [savingTask, setSavingTask] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase || !workspace) return;
      const { data, error: err } = await supabase
        .from('ai_settings')
        .select('task, mode, primary_provider, primary_model, reviewer_provider, reviewer_model')
        .eq('workspace_id', workspace.id);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        return;
      }
      const byTask: Record<string, TaskSetting> = {};
      for (const t of AI_TASKS) byTask[t.id] = DEFAULT_SETTING(t.id);
      for (const row of data ?? []) {
        byTask[row.task as string] = {
          task: row.task as string,
          mode: (row.mode as TaskSetting['mode']) ?? 'anthropic',
          primary_provider:
            (row.primary_provider as TaskSetting['primary_provider']) ?? 'anthropic',
          primary_model: (row.primary_model as string | null) ?? '',
          reviewer_provider:
            (row.reviewer_provider as TaskSetting['reviewer_provider']) ?? 'openai',
          reviewer_model: (row.reviewer_model as string | null) ?? '',
        };
      }
      setSettings(byTask);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id]);

  async function save(task: string) {
    if (!supabase || !workspace || !settings) return;
    const s = settings[task];
    setSavingTask(task);
    setError(null);
    const { error: err } = await supabase.from('ai_settings').upsert(
      {
        workspace_id: workspace.id,
        task: s.task,
        mode: s.mode,
        primary_provider: s.primary_provider,
        primary_model: s.primary_model.trim() || null,
        reviewer_provider: s.reviewer_provider,
        reviewer_model: s.reviewer_model.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,task' },
    );
    setSavingTask(null);
    if (err) setError(err.message);
  }

  function update(task: string, patch: Partial<TaskSetting>) {
    setSettings((prev) => (prev ? { ...prev, [task]: { ...prev[task], ...patch } } : prev));
  }

  if (!workspace) return null;
  if (!settings) return <div className="meta">Loading…</div>;

  return (
    <div className="stack gap-16">
      <div className="card">
        <div className="card-pad stack gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">AI engine</span>
          <span className="meta">
            Choose which model runs each task. Collaboration runs your primary model, has the
            reviewer critique the output, then the primary refines it — slower and pricier, but
            noticeably sharper copy. Leave model blank to use the default.
          </span>
        </div>
        {AI_TASKS.map((t, i) => {
          const s = settings[t.id];
          return (
            <div
              key={t.id}
              className="card-pad stack gap-8"
              style={{
                borderBottom: i < AI_TASKS.length - 1 ? '1px solid var(--border)' : 0,
              }}
            >
              <div className="row between">
                <div className="stack gap-2">
                  <span style={{ fontWeight: 500 }}>{t.label}</span>
                  <span className="meta" style={{ fontSize: 11 }}>
                    {t.hint}
                  </span>
                </div>
                <button
                  className="btn sm"
                  onClick={() => save(t.id)}
                  disabled={savingTask === t.id}
                >
                  {savingTask === t.id ? 'Saving…' : 'Save'}
                </button>
              </div>
              <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
                <label className="stack gap-2">
                  <span className="meta" style={{ fontSize: 11 }}>
                    Mode
                  </span>
                  <select
                    value={s.mode}
                    onChange={(e) => {
                      const mode = e.target.value as TaskSetting['mode'];
                      update(t.id, {
                        mode,
                        ...(mode === 'openai' ? { primary_provider: 'openai' } : {}),
                        ...(mode === 'anthropic' ? { primary_provider: 'anthropic' } : {}),
                      });
                    }}
                    style={inputStyle}
                  >
                    {MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                {s.mode === 'collaboration' && (
                  <label className="stack gap-2">
                    <span className="meta" style={{ fontSize: 11 }}>
                      Generator
                    </span>
                    <select
                      value={s.primary_provider}
                      onChange={(e) =>
                        update(t.id, {
                          primary_provider: e.target.value as TaskSetting['primary_provider'],
                        })
                      }
                      style={inputStyle}
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="stack gap-2">
                  <span className="meta" style={{ fontSize: 11 }}>
                    {s.mode === 'collaboration' ? 'Generator model' : 'Model'}
                  </span>
                  <input
                    type="text"
                    value={s.primary_model}
                    onChange={(e) => update(t.id, { primary_model: e.target.value })}
                    placeholder={s.primary_provider === 'anthropic' ? 'claude-sonnet-5' : 'gpt-4o'}
                    style={{ ...inputStyle, width: 200 }}
                  />
                </label>
                {s.mode === 'collaboration' && (
                  <>
                    <label className="stack gap-2">
                      <span className="meta" style={{ fontSize: 11 }}>
                        Reviewer
                      </span>
                      <select
                        value={s.reviewer_provider}
                        onChange={(e) =>
                          update(t.id, {
                            reviewer_provider: e.target.value as TaskSetting['reviewer_provider'],
                          })
                        }
                        style={inputStyle}
                      >
                        {PROVIDERS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="stack gap-2">
                      <span className="meta" style={{ fontSize: 11 }}>
                        Reviewer model
                      </span>
                      <input
                        type="text"
                        value={s.reviewer_model}
                        onChange={(e) => update(t.id, { reviewer_model: e.target.value })}
                        placeholder={
                          s.reviewer_provider === 'anthropic' ? 'claude-sonnet-5' : 'gpt-4o'
                        }
                        style={{ ...inputStyle, width: 200 }}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {error && (
          <div className="card-pad meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
            ⚠ {error}
          </div>
        )}
      </div>

      <TestRunPanel workspaceId={workspace.id} />
    </div>
  );
}

function TestRunPanel({ workspaceId }: { workspaceId: string }) {
  const runner = useJobRunner<{ headline?: string; sentence?: string }>();

  return (
    <div className="card">
      <div className="card-pad stack gap-8">
        <div className="row between">
          <div className="stack gap-2">
            <span className="h2">Test the engine</span>
            <span className="meta">
              Runs a tiny generation using this workspace's settings for the "test_prompt" task
              (configure it like any other task, or leave it on the default). Verifies API keys,
              settings, skills, and the job pipeline end to end.
            </span>
          </div>
          <button
            className="btn primary sm"
            disabled={runner.running}
            onClick={() => runner.start({ type: 'test_prompt', workspaceId })}
          >
            {runner.running ? 'Running…' : 'Run test'}
          </button>
        </div>

        {runner.startError && (
          <div className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
            ⚠ {runner.startError}
          </div>
        )}
        {runner.job && (
          <div className="stack gap-4">
            <div className="row gap-8">
              <span className="meta">
                {runner.job.status} · {runner.job.progress}%
              </span>
              <span className="meta" style={{ fontSize: 11 }}>
                {runner.job.progress_message}
              </span>
            </div>
            {runner.failed && (
              <div className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
                ⚠ {runner.job.error}
              </div>
            )}
            {runner.completed && runner.job.result && (
              <div className="stack gap-2" style={{ paddingTop: 4 }}>
                <span style={{ fontWeight: 500 }}>{runner.job.result.headline}</span>
                <span className="meta">{runner.job.result.sentence}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
