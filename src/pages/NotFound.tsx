import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState icon="search" title="Nothing lives here" action={<Link className="btn btn--primary" to="/">Back to Today</Link>}>
        The page may have moved, or the link is incomplete.
      </EmptyState>
    </div>
  );
}
