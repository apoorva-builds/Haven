import { useState, type FormEvent } from 'react';
import type { Idea, TaskStage } from '../../data/types';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { AccountBadge, Avatar, EmptyState } from '../../components/ui';
import { addDays, relativeDay } from '../../lib/dates';
import { accountOf, personOf, tasksForIdea, versionsForIdea } from '../../state/selectors';
import { useStore } from '../../state/store';

const STAGES: TaskStage[] = ['Plan', 'Shoot', 'Edit', 'Review', 'Post'];

export function IdeaTasks({ idea }: { idea: Idea }) {
  const { data, dispatch, allowed } = useStore();
  const toast = useToast();
  const tasks = tasksForIdea(data, idea.id);
  const versions = versionsForIdea(data, idea.id);
  const draft = (versionId: string, ownerId: string) =>
    ({ type: 'task/add', task: { title: 'x', ideaId: idea.id, versionId: versionId || undefined, ownerId, stage: 'Plan', due: data.today } }) as const;
  // Where this person may add tasks: the whole idea (Space edit) and/or the versions they can edit.
  const targets = ['', ...versions.map((v) => v.id)].filter((id) => allowed(draft(id, data.currentUserId)));
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState(data.currentUserId);
  const [stage, setStage] = useState<TaskStage>('Plan');
  const [due, setDue] = useState(addDays(data.today, 1));
  const [versionId, setVersionId] = useState(targets[0] ?? '');
  // Assignees must be able to see the work they're given.
  const owners = data.people.filter((p) => allowed(draft(versionId, p.id)));
  const owner = owners.some((p) => p.id === ownerId) ? ownerId : (owners[0]?.id ?? '');

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !owner) return;
    dispatch({ type: 'task/add', task: { title: title.trim(), ideaId: idea.id, versionId: versionId || undefined, ownerId: owner, stage, due } });
    setTitle('');
    toast('Task added for this session.', 'demo');
  };

  const done = tasks.filter((t) => t.done).length;

  return (
    <div className="stack">
      {targets.length === 0 ? null : (
      <form className="card task-form" onSubmit={add} aria-label="Add a task">
        <input className="task-form__title" placeholder="Add a task — e.g. Export captions file for Jonah" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Task title" />
        <select value={owner} onChange={(e) => setOwnerId(e.target.value)} aria-label="Owner">
          {owners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={stage} onChange={(e) => setStage(e.target.value as TaskStage)} aria-label="Stage">
          {STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={versionId} onChange={(e) => setVersionId(e.target.value)} aria-label="Version">
          {targets.map((id) => {
            const v = versions.find((x) => x.id === id);
            return (
              <option key={id || 'idea'} value={id}>
                {v ? `${accountOf(data, v.accountId)?.handle} · ${v.format}` : 'Whole idea'}
              </option>
            );
          })}
        </select>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        <button type="submit" className="btn btn--primary" disabled={!title.trim() || !owner}>
          <Icon name="plus" size={15} /> Add
        </button>
      </form>
      )}

      {tasks.length === 0 ? (
        <EmptyState icon="check" title="No tasks yet">
          Break the idea into steps and assign them — tasks show up on each person’s Today.
        </EmptyState>
      ) : (
        <>
          <div className="stage-progress" aria-label={`${done} of ${tasks.length} tasks done`}>
            {STAGES.map((s) => {
              const inStage = tasks.filter((t) => t.stage === s);
              const complete = inStage.length > 0 && inStage.every((t) => t.done);
              return (
                <span key={s} className={`stage ${complete ? 'is-done' : ''} ${inStage.length === 0 ? 'is-empty' : ''}`}>
                  {s}
                  <span className="count">
                    {inStage.filter((t) => t.done).length}/{inStage.length}
                  </span>
                </span>
              );
            })}
          </div>
          <ul className="task-list task-list--card">
            {[...tasks]
              .sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due))
              .map((t) => {
                const owner = personOf(data, t.ownerId)!;
                const version = versions.find((v) => v.id === t.versionId);
                const account = accountOf(data, version?.accountId);
                return (
                  <li key={t.id} className={`task ${t.done ? 'is-done' : ''}`}>
                    <button type="button" className="check" aria-pressed={t.done} aria-label={t.done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`} disabled={!allowed({ type: 'task/toggle', taskId: t.id })} onClick={() => dispatch({ type: 'task/toggle', taskId: t.id })}>
                      <Icon name="check" size={14} />
                    </button>
                    <div className="task__body">
                      <p className="task__title">{t.title}</p>
                      <p className="task__meta">
                        <span className="tag">{t.stage}</span>
                        {account && <AccountBadge account={account} showHandle />}
                        {t.recurring && <span className="tag">{t.recurring}</span>}
                      </p>
                    </div>
                    <span className={`task__due ${!t.done && t.due < data.today ? 'is-overdue' : ''}`}>{relativeDay(t.due, data.today)}</span>
                    <Avatar person={owner} size={26} />
                  </li>
                );
              })}
          </ul>
        </>
      )}
    </div>
  );
}
