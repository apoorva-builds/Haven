import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { createDemoData } from '../data/demo';
import type { DemoData } from '../data/types';
import { reducer, type Action } from './reducer';

interface StoreValue {
  data: DemoData;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, initial }: { children: ReactNode; initial?: DemoData }) {
  const [data, dispatch] = useReducer(reducer, initial ?? null, (init) => init ?? createDemoData());
  const value = useMemo(() => ({ data, dispatch }), [data]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
