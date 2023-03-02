import { useEffect } from 'react';
import { useAppDispatch } from '../hooks';
import { moveFeature, nestFeatureUnder, setActive } from '../mapSlice';

const FEATURE = 'plantopo/feature';
const FEAT_CLASS = 'tree-feature';
const DRAGGED_CLASS = 'tree-feature--dragged';
const INSERTPOINT_ABOVE = 'tree-feature--insertpoint-above';
const INSERTPOINT_BELOW = 'tree-feature--insertpoint-below';
const INSERTPOINT_FIRST_CHILD = 'tree-feature--insertpoint-first-child';

export default function useFeatureTreeDrag(
  treeRef: React.RefObject<HTMLDivElement>,
) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let elem: HTMLElement | undefined;

    const handler = (e: DragEvent) => {
      const treeElem = treeRef.current;
      if (!e.dataTransfer || !treeElem) return;
      const dt = e.dataTransfer;

      if (e.type === 'dragstart') {
        const targetFeatElem = closestFeature(e.target as HTMLElement);
        if (!targetFeatElem) return;

        elem = targetFeatElem as HTMLElement;
        dt.effectAllowed = 'move';
        dt.setData(FEATURE, 'move');
        elem.classList.add(DRAGGED_CLASS);
        dispatch(setActive(elem.dataset.feature));
      } else if (elem && e.type === 'dragover') {
        e.preventDefault(); // allow drag over

        // For the x we just want anything inside the tree
        const targetFeatOrChild = document.elementFromPoint(20, e.clientY);
        if (!(targetFeatOrChild instanceof HTMLElement)) return;
        const targetFeat = closestFeature(targetFeatOrChild);

        if (targetFeat && targetFeat === elem) {
          // disallowed, keep the insert marker wherever it was before
        } else if (targetFeat && targetFeat.dataset.featureType === 'group') {
          // Possibly nested under targetFeat
          const targetBox = targetFeat.getBoundingClientRect();
          const beforeTargetBottom = targetBox.y + targetBox.height / 3;
          const afterTargetTop = beforeTargetBottom + targetBox.height / 3;

          if (e.clientY < beforeTargetBottom) {
            setInsertFeat(treeElem, targetFeat, INSERTPOINT_ABOVE);
          } else if (e.clientY > afterTargetTop) {
            setInsertFeat(treeElem, targetFeat, INSERTPOINT_BELOW);
          } else {
            const firstChild = targetFeat.querySelector(`.${FEAT_CLASS}`);
            if (firstChild) {
              setInsertFeat(
                treeElem,
                firstChild as HTMLElement,
                INSERTPOINT_ABOVE,
              );
            } else {
              setInsertFeat(treeElem, targetFeat, INSERTPOINT_FIRST_CHILD);
            }
          }
        } else if (targetFeat) {
          // Right before or after and at the same level as targetFeat
          const targetBox = targetFeat.getBoundingClientRect();
          const targetMiddle = targetBox.y + targetBox.height / 2;
          if (e.clientY < targetMiddle) {
            setInsertFeat(treeElem, targetFeat, INSERTPOINT_ABOVE);
          } else {
            setInsertFeat(treeElem, targetFeat, INSERTPOINT_BELOW);
          }
        } else {
          // Before first or after last

          // Since we keep dragged elements in the DOM there needs to be at
          // least one to get here
          const all = treeElem.getElementsByClassName(FEAT_CLASS);
          const first = all[0] as HTMLElement;
          const last = all[all.length - 1] as HTMLElement;
          const firstBox = first.getBoundingClientRect();

          if (e.clientY < firstBox.top + firstBox.height / 2) {
            setInsertFeat(treeElem, first, INSERTPOINT_ABOVE);
          } else {
            setInsertFeat(treeElem, last, INSERTPOINT_BELOW);
          }
        }
      } else if (elem && e.type === 'drop') {
        const id = elem.dataset.feature!;

        const beforeElem = treeElem.querySelector(`.${INSERTPOINT_BELOW}`);
        const afterElem = treeElem.querySelector(`.${INSERTPOINT_ABOVE}`);
        const beforeId = beforeElem?.getAttribute('data-feature') ?? undefined;
        const afterId = afterElem?.getAttribute('data-feature') ?? undefined;

        if (beforeId || afterId) {
          dispatch(moveFeature({ id, afterId, beforeId }));
        } else {
          const parentElem = treeElem.querySelector(
            `.${INSERTPOINT_FIRST_CHILD}`,
          );
          if (!parentElem) {
            console.error('no before, after, or parent elems');
            return;
          }
          const parentId = parentElem.getAttribute('data-feature')!;
          dispatch(nestFeatureUnder({ id, parentId }));
        }

        clearDragClasses(treeElem);
        elem = undefined;
      } else if (elem && e.type === 'dragend') {
        clearDragClasses(treeElem);
        elem = undefined;
      }
    };

    window.addEventListener('dragover', handler);
    window.addEventListener('dragstart', handler);
    window.addEventListener('drop', handler);
    window.addEventListener('dragend', handler);

    return () => {
      window.removeEventListener('dragover', handler);
      window.removeEventListener('dragstart', handler);
      window.removeEventListener('drop', handler);
      window.removeEventListener('dragend', handler);
    };
  }, [dispatch, treeRef]);
}

const closestFeature = (el: HTMLElement) =>
  el.closest(`.${FEAT_CLASS}`) as HTMLElement | null;

const clearDragClasses = (treeElem: HTMLDivElement) => {
  for (const cls of [
    DRAGGED_CLASS,
    INSERTPOINT_ABOVE,
    INSERTPOINT_BELOW,
    INSERTPOINT_FIRST_CHILD,
  ]) {
    for (const prevEl of treeElem.getElementsByClassName(cls)) {
      prevEl.classList.remove(cls);
    }
  }
};

const setInsertFeat = (
  treeElem: HTMLDivElement,
  el: HTMLElement,
  className: string,
) => {
  for (const cls of [
    INSERTPOINT_ABOVE,
    INSERTPOINT_BELOW,
    INSERTPOINT_FIRST_CHILD,
  ]) {
    for (const prevEl of treeElem.getElementsByClassName(cls)) {
      if (!(prevEl === el && cls === className)) {
        prevEl.classList.remove(cls);
      }
    }
  }
  el.classList.add(className);
};
