import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import { configureStore } from "@reduxjs/toolkit";

import panelReducer from "./panelSlice";
import credentialsReducer from "./credentialsSlice";
import mobileReducer from "./mobileSlice";

const persist = (key, reducer) => {
  const config = {
    key,
    storage,
  };
  return persistReducer(config, reducer);
};

export const store = configureStore({
  reducer: {
    panel: persist("panel", panelReducer),
    credentials: persist("credentials", credentialsReducer),
    mobile: persist("mobile", mobileReducer),
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
