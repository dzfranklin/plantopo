import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import { v4 as uuidImpl } from "uuid";

export const store = configureStore({
  reducer: {},
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

export const uuid = uuidImpl;
