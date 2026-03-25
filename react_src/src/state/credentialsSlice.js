import { createSlice } from "@reduxjs/toolkit";

export const credentialsSlice = createSlice({
  name: "credentials",
  initialState: {
    credentials: null,
    isAdmin: false,
    sessionId: null,
  },
  reducers: {
    setCredentials: (state, action) => {
      state.credentials = action.payload.credentials;
      state.isAdmin = action.payload.isAdmin || false;
      state.sessionId = action.payload.sessionId || null;
    },
    removeCredentials: (state) => {
      state.credentials = null;
      state.isAdmin = false;
      state.sessionId = null;
    },
  },
});

export const { removeCredentials, setCredentials } = credentialsSlice.actions;

export default credentialsSlice.reducer;