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
import themeReducer from "./themeSlice";
import credentialStorage from "./credentialStorage";

const persist = (key, reducer, customStorage) => {
  const config = {
    key,
    storage: customStorage ?? storage,
  };
  return persistReducer(config, reducer);
};

export const store = configureStore({
  reducer: {
    panel: persist("panel", panelReducer),
    credentials: persist("credentials", credentialsReducer, credentialStorage),
    mobile: persist("mobile", mobileReducer),
    theme: persist("theme", themeReducer),
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
