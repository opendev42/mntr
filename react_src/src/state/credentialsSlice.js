import { createSlice } from "@reduxjs/toolkit";

export const credentialsSlice = createSlice({
  name: "credentials",
  initialState: {
    credentials: null,
    isAdmin: false,
  },
  reducers: {
    setCredentials: (state, action) => {
      state.credentials = action.payload.credentials;
      state.isAdmin = action.payload.isAdmin || false;
    },
    removeCredentials: (state) => {
      state.credentials = null;
      state.isAdmin = false;
    },
  },
});

export const { removeCredentials, setCredentials } = credentialsSlice.actions;

export default credentialsSlice.reducer;