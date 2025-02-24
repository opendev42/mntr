import { createSlice } from "@reduxjs/toolkit";

export const credentialsSlice = createSlice({
  name: "credentials",
  initialState: {
    credentials: null,
  },
  reducers: {
    setCredentials: (state, action) => {
      state.credentials = action.payload.credentials;
    },
    removeCredentials: (state) => {
      state.credentials = null;
    },
  },
});

export const { removeCredentials, setCredentials } = credentialsSlice.actions;

export default credentialsSlice.reducer;
