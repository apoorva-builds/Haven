import { Link } from 'react-router-dom';
import { useStore } from '../state/store';
import { EmptyState } from './ui';

/**
 * A direct link to work the previewed person can't access. In the preview
 * this only reflects the tab's filter; the server will enforce it for real.
 */
export function NotShared({ kind, personId }: { kind: 'idea' | 'creation'; personId: string }) {
  const { data } = useStore();
  const name = data.people.find((p) => p.id === personId)?.name ?? 'This person';
  return (
    <div className="page">
      <EmptyState
        icon="shield"
        title={`This ${kind} isn’t shared with ${name}`}
        action={
          <Link className="btn btn--primary" to={kind === 'idea' ? '/ideas' : '/gallery'}>
            {kind === 'idea' ? 'Back to Ideas' : 'Back to Creation Gallery'}
          </Link>
        }
      >
        {name} can open only the Spaces and accounts an admin has assigned, and the files used by that work. Preview: this tab applies the rule; real
        sign-in will enforce it on the server.
      </EmptyState>
    </div>
  );
}
