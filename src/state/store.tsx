import { createContext, useCallback, useContext, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { createDemoData } from '../data/demo';
import type { Capability, DemoData } from '../data/types';
import { authorize, capabilitiesOn, scopeData, type Hidden } from '../lib/access';
import { reducer, type Action } from './reducer';

/**
 * "Preview as" a collaborator: the pages receive only what that person would
 * see, and every change is checked against their access. This guards the
 * current tab for design review. It is not security: the full sample
 * workspace is still in this browser's memory. Real enforcement is on the
 * server (supabase/migrations).
 */
export interface AccessPreview {
  personId: string;
  hidden: Hidden;
}

/** The last change that was refused, with the reason to show. */
export interface Refusal {
  reason: string;
  at: number;
}

interface StoreValue {
  /** The workspace as the current viewer sees it. */
  data: DemoData;
  /** Applies an action only if the viewer is allowed to; otherwise records a refusal. */
  dispatch: Dispatch<Action>;
  /** Whether the viewer may perform this action (use it to disable controls). */
  allowed: (action: Action) => boolean;
  preview: AccessPreview | null;
  setPreviewAs: (personId: string | null) => void;
  /** Whether the viewer has a capability on an account. */
  can: (capability: Capability, accountId: string) => boolean;
  refusal: Refusal | null;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, initial }: { children: ReactNode; initial?: DemoData }) {
  const [full, rawDispatch] = useReducer(reducer, initial ?? null, (init) => init ?? createDemoData());
  const [previewAs, setPreviewAs] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const viewer = previewAs ?? full.currentUserId;

  // Checks run against the latest state, including changes dispatched earlier
  // in the same event (e.g. add a file, then link it to a version).
  const latest = useRef(full);
  latest.current = full;
  const allowed = useCallback((action: Action) => authorize(full, viewer, action).ok, [full, viewer]);
  const dispatch = useCallback<Dispatch<Action>>(
    (action) => {
      const decision = authorize(latest.current, viewer, action);
      if (decision.ok) {
        latest.current = reducer(latest.current, action);
        rawDispatch(action);
      } else setRefusal({ reason: decision.reason, at: Date.now() });
    },
    [viewer],
  );

  const value = useMemo<StoreValue>(() => {
    const member = full.members.find((m) => m.personId === viewer);
    const can = (capability: Capability, accountId: string) => capabilitiesOn(full, member, accountId).has(capability);
    if (!previewAs) return { data: full, dispatch, allowed, preview: null, setPreviewAs, can, refusal };
    const scoped = scopeData(full, previewAs);
    return { data: scoped.data, dispatch, allowed, preview: { personId: previewAs, hidden: scoped.hidden }, setPreviewAs, can, refusal };
  }, [full, previewAs, viewer, dispatch, allowed, refusal]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
