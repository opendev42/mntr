import { createSlice } from "@reduxjs/toolkit";

export const mobileSlice = createSlice({
  name: "mobile",
  initialState: {
    isMobile: 0,
  },
  reducers: {
    setMobile: (state) => {
      state.isMobile = 1;
    },
    removeMobile: (state) => {
      state.isMobile = 0;
    },
  },
  selectors: {
    selectIsMobile: (state) => state.mobile.isMobile,
  },
});

export const { removeMobile, setMobile } = mobileSlice.actions;

export default mobileSlice.reducer;