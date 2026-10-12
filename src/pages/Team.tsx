import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CAPABILITIES, type AccessGrant, type AccessScope, type Capability, type DemoData, type Member, type WorkspaceRole } from '../data/types';
import { Icon } from '../components/Icon';
import { InfoButton } from '../components/InfoButton';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Avatar, DemoTag, EmptyState, PlatformGlyph } from '../components/ui';
import { CAPABILITY_LABEL, accessSummary, capabilitiesOnSpace } from '../lib/access';
import { platformOf } from '../state/selectors';
import { useStore } from '../state/store';

const ROLE_LABEL: Record<WorkspaceRole, string> = { owner: 'Owner', admin: 'Admin', collaborator: 'Collaborator' };

/** Team & access (preview): members, invitations and access by Space and account. */
export function TeamPage() {
  const { data, preview, setPreviewAs } = useStore();
  const [selected, setSelected] = useState(data.members.find((m) => m.role === 'collaborator')?.personId ?? data.members[0]?.personId);
  const [inviting, setInviting] = useState(false);

  if (preview) {
    const who = data.people.find((p) => p.id === preview.personId)?.name ?? 'This person';
    return (
      <div className="page">
        <EmptyState
          icon="shield"
          title="Only the owner and admins manage access"
          action={
            <button type="button" className="btn btn--primary" onClick={() => setPreviewAs(null)}>
              Back to your view
            </button>
          }
        >
          {who} wouldn’t see Team & access.
        </EmptyState>
      </div>
    );
  }

  const active = data.members.filter((m) => m.status === 'active').length;
  const invited = data.members.length - active;
  const member = data.members.find((m) => m.personId === selected);

  return (
    <div className="page team-page">
      <header className="studio-head">
        <div className="studio-head__title">
          <span className="with-info">
            <h1 className="studio-head__h">Team & access</h1>
            <InfoButton k="team" />
          </span>
          <p className="studio-head__count">
            {active} member{active === 1 ? '' : 's'}
            {invited > 0 && <> · {invited} invited</>}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setInviting(true)}>
          <Icon name="plus" size={16} /> Invite person
        </button>
      </header>

      <div className="team-note" role="note">
        <p>
          <strong>Preview.</strong> Access here filters this browser tab so you can see what each person would get. It isn’t security yet: real sign-in and
          server-enforced access come with the backend.
        </p>
        <p>
          <Icon name="shield" size={15} /> Haven never asks for social account passwords. Each person signs in to Haven as themselves; a handle only identifies
          an account.
        </p>
      </div>

      <div className="team-grid">
        <section className="team-members" aria-labelledby="members-h">
          <h2 id="members-h" className="idea-section__h">
            Members
          </h2>
          <ul className="member-list">
            {data.members.map((m) => {
              const person = data.people.find((p) => p.id === m.personId);
              if (!person) return null;
              return (
                <li key={m.personId}>
                  <button type="button" className={`member-row ${m.personId === selected ? 'is-selected' : ''}`} aria-pressed={m.personId === selected} onClick={() => setSelected(m.personId)}>
                    <Avatar person={person} size={36} />
                    <span className="member-row__text">
                      <span className="member-row__name">
                        {person.name}
                        {m.status === 'invited' && <span className="member-row__invited">Invited</span>}
                      </span>
                      <span className="member-row__email">{m.email}</span>
                      <span className="member-row__access">{accessSummary(data, m)}</span>
                    </span>
                    <span className={`member-row__role role--${m.role}`}>{ROLE_LABEL[m.role]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {member && <AccessEditor key={member.personId} data={data} member={member} onRemoved={() => setSelected(data.members[0].personId)} />}
      </div>
      {inviting && <InviteModal data={data} onClose={() => setInviting(false)} />}
    </div>
  );
}

function AccessEditor({ data, member, onRemoved }: { data: DemoData; member: Member; onRemoved: () => void }) {
  const { dispatch, setPreviewAs } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const person = data.people.find((p) => p.id === member.personId)!;
  const full = member.role !== 'collaborator';

  return (
    <section className="access-editor panel" aria-labelledby="access-h">
      <header className="access-editor__head">
        <Avatar person={person} size={44} />
        <div className="access-editor__who">
          <h2 id="access-h" className="access-editor__h">
            {person.name}
          </h2>
          <p className="access-editor__email">
            {member.email}
            {member.status === 'invited' && ' · invitation pending (preview: no email was sent)'}
          </p>
        </div>
        {member.role === 'owner' ? (
          <span className="member-row__role role--owner">Owner</span>
        ) : (
          <label className="access-editor__role">
            <span className="sr-only">Role for {person.name}</span>
            <select value={member.role} onChange={(e) => dispatch({ type: 'member/role', personId: member.personId, role: e.target.value as 'admin' | 'collaborator' })}>
              <option value="admin">Admin</option>
              <option value="collaborator">Collaborator</option>
            </select>
          </label>
        )}
      </header>

      {full ? (
        <p className="access-editor__full">
          <Icon name="shield" size={16} /> Full access to every Space, social account and file in this workspace
          {member.role === 'admin' ? ', and can manage the team.' : ', the team and (later) billing.'}
        </p>
      ) : (
        <>
          <table className="access-table">
            <caption className="sr-only">Access for {person.name} by Space and social account</caption>
            <thead>
              <tr>
                <th scope="col">Space or account</th>
                {CAPABILITIES.map((c) => (
                  <th key={c} scope="col">
                    {CAPABILITY_LABEL[c]}
                  </th>
                ))}
              </tr>
            </thead>
            {data.brands.map((space) => {
              const spaceScope: AccessScope = { kind: 'space', id: space.id };
              const spaceCaps = capabilitiesOnSpace({ ...member, status: 'active' }, space.id);
              return (
                <tbody key={space.id} className="access-table__space">
                  <tr className="access-row access-row--space">
                    <th scope="row">
                      <span className="access-row__name">{space.name}</span>
                      <span className="access-row__hint">Whole Space · all its accounts and files</span>
                    </th>
                    {CAPABILITIES.map((c) => (
                      <td key={c}>
                        <CapBox
                          label={`${CAPABILITY_LABEL[c]}: ${space.name} (whole Space)`}
                          checked={spaceCaps.has(c)}
                          onChange={(on) => dispatch({ type: 'member/grant', personId: member.personId, scope: spaceScope, capability: c, on })}
                        />
                      </td>
                    ))}
                  </tr>
                  {data.accounts
                    .filter((a) => a.brandId === space.id)
                    .map((a) => {
                      const platform = platformOf(data, a.platform);
                      const own = member.grants.find((g) => g.scope.kind === 'account' && g.scope.id === a.id)?.capabilities ?? [];
                      return (
                        <tr key={a.id} className="access-row">
                          <th scope="row">
                            <span className="access-row__account">
                              <PlatformGlyph platform={platform} size="sm" />
                              <span>
                                {platform.name} <span className="muted">{a.handle}</span>
                              </span>
                            </span>
                          </th>
                          {CAPABILITIES.map((c) => {
                            const inherited = spaceCaps.has(c);
                            return (
                              <td key={c}>
                                <CapBox
                                  label={`${CAPABILITY_LABEL[c]}: ${platform.name} ${a.handle}`}
                                  checked={inherited || own.includes(c)}
                                  inherited={inherited}
                                  onChange={(on) => dispatch({ type: 'member/grant', personId: member.personId, scope: { kind: 'account', id: a.id }, capability: c, on })}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              );
            })}
          </table>
          <p className="access-editor__foot">
            <span className="with-info">
              Edit, review and publish include view. Files follow the work: people see the files used by what they can open, never the rest.
              <InfoButton k="capabilities" />
            </span>
          </p>
          <p className="access-editor__foot">Publish records a post as live. Haven has no platform connections yet, so posting stays manual in each app.</p>
        </>
      )}

      {member.role !== 'owner' && (
        <div className="access-editor__actions">
          {member.role === 'collaborator' && member.status === 'active' && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setPreviewAs(member.personId);
                navigate('/');
              }}
            >
              <Icon name="user" size={15} /> Preview as {person.name}
            </button>
          )}
          <button
            type="button"
            className="link-btn access-editor__remove"
            onClick={() => {
              dispatch({ type: 'member/remove', personId: member.personId });
              toast(member.status === 'invited' ? `Invitation for ${person.name} withdrawn (preview).` : `${person.name} removed from this preview workspace.`, 'demo');
              onRemoved();
            }}
          >
            {member.status === 'invited' ? 'Withdraw invitation' : 'Remove from workspace'}
          </button>
        </div>
      )}
    </section>
  );
}

function CapBox({ label, checked, inherited = false, onChange }: { label: string; checked: boolean; inherited?: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className={`capbox ${inherited ? 'is-inherited' : ''}`} title={inherited ? 'Included with the whole Space' : undefined}>
      <input type="checkbox" checked={checked} disabled={inherited} aria-label={inherited ? `${label}, included with the whole Space` : label} onChange={(e) => onChange(e.target.checked)} />
      <span className="capbox__mark" aria-hidden="true">
        <Icon name="check" size={12} />
      </span>
    </label>
  );
}

function InviteModal({ data, onClose }: { data: DemoData; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'collaborator'>('collaborator');
  const [spaces, setSpaces] = useState<string[]>([]);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const taken = data.members.some((m) => m.email === email.trim().toLowerCase());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || taken) return;
    const grants: AccessGrant[] = role === 'collaborator' ? spaces.map((id) => ({ scope: { kind: 'space', id }, capabilities: ['view', 'edit'] as Capability[] })) : [];
    dispatch({ type: 'member/invite', name, email, role, grants });
    toast('Preview: the invitation is listed, but no email was sent.', 'demo');
    onClose();
  };

  return (
    <Modal
      title="Invite a person"
      onClose={onClose}
      footer={
        <>
          <DemoTag>Preview · nothing is sent</DemoTag>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="invite" className="btn btn--primary" disabled={!valid || taken}>
            Add invitation
          </button>
        </>
      }
    >
      <form id="invite" className="form" onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required aria-describedby="invite-email-note" />
        </label>
        <p id="invite-email-note" className="muted field-note">
          {taken ? 'This person is already in the workspace.' : 'They’ll sign in to Haven with this address. Never share social account passwords.'}
        </p>
        <label className="field">
          <span>Name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'collaborator')}>
            <option value="collaborator">Collaborator: only what you assign</option>
            <option value="admin">Admin: full access, manages the team</option>
          </select>
        </label>
        {role === 'collaborator' && (
          <fieldset className="field">
            <legend>Start with these Spaces (view, edit & upload)</legend>
            <div className="chip-grid">
              {data.brands.map((b) => {
                const on = spaces.includes(b.id);
                return (
                  <button type="button" key={b.id} className={`chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => setSpaces((s) => (on ? s.filter((x) => x !== b.id) : [...s, b.id]))}>
                    {b.name}
                  </button>
                );
              })}
            </div>
            <p className="muted field-note">You can fine-tune access by account afterwards.</p>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
