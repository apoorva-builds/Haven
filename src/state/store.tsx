import { createContext, useContext, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { createDemoData } from '../data/demo';
import type { DemoData } from '../data/types';
import { capabilitiesOn, scopeData, type Hidden } from '../lib/access';
import type { Capability } from '../data/types';
import { reducer, type Action } from './reducer';

/**
 * "Preview as" a collaborator: the pages receive only what that person would
 * see. This filters the current tab for design review. It is not security:
 * the full sample workspace is still in this browser's memory.
 */
export interface AccessPreview {
  personId: string;
  hidden: Hidden;
}

interface StoreValue {
  /** The workspace as the current viewer sees it. */
  data: DemoData;
  dispatch: Dispatch<Action>;
  preview: AccessPreview | null;
  setPreviewAs: (personId: string | null) => void;
  /** Whether the viewer may do this on an account. Always true outside a preview. */
  can: (capability: Capability, accountId: string) => boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, initial }: { children: ReactNode; initial?: DemoData }) {
  const [full, dispatch] = useReducer(reducer, initial ?? null, (init) => init ?? createDemoData());
  const [previewAs, setPreviewAs] = useState<string | null>(null);
  const value = useMemo<StoreValue>(() => {
    if (!previewAs) return { data: full, dispatch, preview: null, setPreviewAs, can: () => true };
    const member = full.members.find((m) => m.personId === previewAs);
    const scoped = scopeData(full, previewAs);
    return {
      data: scoped.data,
      dispatch,
      preview: { personId: previewAs, hidden: scoped.hidden },
      setPreviewAs,
      can: (capability, accountId) => capabilitiesOn(full, member, accountId).has(capability),
    };
  }, [full, previewAs]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
