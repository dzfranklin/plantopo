import { useAppDispatch, useAppSelector, useAppStore } from './hooks';
import {
  cancelCreating,
  deleteFeature,
  selectActiveFeature,
  selectDataLoaded,
  selectInCreate,
  enterLatlngPicker,
  createGroup,
} from './mapSlice';
import { useEffect } from 'react';

export const useGlobalKeyboardShortcuts = () => {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const dataLoaded = useAppSelector(selectDataLoaded);

  useEffect(() => {
    if (!dataLoaded) return;
    const handler = (event: KeyboardEvent) => {
      const { key, ctrlKey, altKey } = event;
      const state = store.getState();
      const active = selectActiveFeature(state);
      const inCreate = selectInCreate(state);

      if (key === 'Delete' && active) {
        dispatch(deleteFeature(active));
      } else if (key === 'Escape' && inCreate) {
        dispatch(cancelCreating());
      } else if (ctrlKey && altKey && key === 'p') {
        dispatch(enterLatlngPicker({ type: 'point' }));
      } else if (ctrlKey && altKey && key === 'r') {
        dispatch(enterLatlngPicker({ type: 'route' }));
      } else if (ctrlKey && altKey && key === 'f') {
        dispatch(createGroup());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dataLoaded, dispatch, store]);
};
