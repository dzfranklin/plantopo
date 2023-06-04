import { useAppDispatch, useAppStore } from './hooks';
import { useEffect } from 'react';
import { selectSidebarOpen } from './sidebar/slice';

export const useGlobalKeyboardShortcuts = () => {
  const store = useAppStore();
  const dispatch = useAppDispatch();

  // TODO:
  // useEffect(() => {
  //   const handler = (event: KeyboardEvent) => {
  //     const { key, ctrlKey, altKey, metaKey, shiftKey } = event;
  //     const anyMod = ctrlKey || altKey || metaKey || shiftKey;
  //     const state = store.getState();
  //     const active = selectActiveFeature(state);
  //     const inCreate = !!selectCreating(state);
  //     const sidebarOpen = selectSidebarOpen(state);

  //     let action;
  //     if (!anyMod && key === 'Delete' && active) {
  //       action = deleteFeature(active);
  //     } else if (!anyMod && key === 'Escape' && inCreate) {
  //       action = cancelCreating();
  //     } else if (!anyMod && key === 'Escape' && active) {
  //       action = setActive(undefined);
  //     } else if (ctrlKey && altKey && key === 'p') {
  //       action = enterLatlngPicker({ type: 'point' });
  //     } else if (ctrlKey && altKey && key === 'r') {
  //       action = enterLatlngPicker({ type: 'route' });
  //     } else if (ctrlKey && altKey && key === 'f') {
  //       action = createGroup();
  //     } else if (sidebarOpen) {
  //       if (!anyMod && key === 'ArrowDown') {
  //         action = moveActive('down');
  //       } else if (!anyMod && key === 'ArrowUp') {
  //         action = moveActive('up');
  //       } else if (!anyMod && key === 'ArrowRight') {
  //         action = moveActive('in');
  //       } else if (!anyMod && key === 'ArrowLeft') {
  //         action = moveActive('out');
  //       }
  //     }

  //     if (action) {
  //       dispatch(action);
  //       event.preventDefault();
  //       event.stopPropagation();
  //     }
  //   };
  //   window.addEventListener('keydown', handler);
  //   return () => window.removeEventListener('keydown', handler);
  // }, [dispatch, store]);
};
