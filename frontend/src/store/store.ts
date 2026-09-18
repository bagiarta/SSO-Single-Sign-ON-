import { configureStore } from '@reduxjs/toolkit';

/**
 * Redux store configuration for Enterprise SSO Management
 */
import providerReducer from './providerSlice';
import userReducer from './userSlice';
import masterDataReducer from './masterDataSlice';

/**
 * Redux store configuration for Enterprise SSO Management
 */
export const store = configureStore({
  reducer: {
    providers: providerReducer,
    users: userReducer,
    masterData: masterDataReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serialization check
        ignoredActions: [],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
