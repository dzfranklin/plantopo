import { useAppDispatch, useAppSelector, useAppStore } from './hooks';
import { selectSidebarOpen } from './mapSlice';
import { useEffect } from 'react';
import { selectDidInitialLoad } from './sync/slice';
import {
  cancelCreating,
  createGroup,
  deleteFeature,
  enterLatlngPicker,
  moveActive,
  selectActiveFeature,
  selectCreating,
} from './features/slice';

export const useGlobalKeyboardShortcuts = () => {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const loaded = useAppSelector(selectDidInitialLoad);

  useEffect(() => {
    if (!loaded) return;

    const handler = (event: KeyboardEvent) => {
      const { key, ctrlKey, altKey, metaKey, shiftKey } = event;
      const anyMod = ctrlKey || altKey || metaKey || shiftKey;
      const state = store.getState();
      const active = selectActiveFeature(state);
      const inCreate = !!selectCreating(state);
      const sidebarOpen = selectSidebarOpen(state);

      let action;
      if (!anyMod && key === 'Delete' && active) {
        action = deleteFeature(active);
      } else if (!anyMod && key === 'Escape' && inCreate) {
        action = cancelCreating();
      } else if (ctrlKey && altKey && key === 'p') {
        action = enterLatlngPicker({ type: 'point' });
      } else if (ctrlKey && altKey && key === 'r') {
        action = enterLatlngPicker({ type: 'route' });
      } else if (ctrlKey && altKey && key === 'f') {
        action = createGroup();
      } else if (sidebarOpen) {
        if (!anyMod && key === 'ArrowDown') {
          action = moveActive('down');
        } else if (!anyMod && key === 'ArrowUp') {
          action = moveActive('up');
        } else if (!anyMod && key === 'ArrowRight') {
          action = moveActive('in');
        } else if (!anyMod && key === 'ArrowLeft') {
          action = moveActive('out');
        }
      }

      if (action) {
        dispatch(action);
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [loaded, dispatch, store]);
};
