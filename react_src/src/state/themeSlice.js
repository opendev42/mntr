import { createSlice } from "@reduxjs/toolkit";

export const themeSlice = createSlice({
  name: "theme",
  initialState: {
    isDark: false,
  },
  reducers: {
    setDark: (state) => {
      state.isDark = true;
    },
    setLight: (state) => {
      state.isDark = false;
    },
  },
});

export const { setDark, setLight } = themeSlice.actions;

export default themeSlice.reducer;
