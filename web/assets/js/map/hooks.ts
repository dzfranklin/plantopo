import { useReducedMotion } from "framer-motion";
import {
  TypedUseSelectorHook,
  useDispatch,
  useSelector,
  useStore,
} from "react-redux";
import type { RootState, AppDispatch, AppStore } from "./store";

// @ts-ignore
export const useAppStore: () => AppStore = useStore;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
