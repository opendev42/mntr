import { createSlice } from "@reduxjs/toolkit";

const initPanel = (overrides) => {
  return {
    channel: "",
    state: {},
    dataGrid: Object.assign(
      { x: 0, y: 0, w: 8, h: 16, minW: 4, minH: 4 },
      overrides,
    ),
  };
};

export const panelSlice = createSlice({
  name: "panel",
  initialState: {
    currentWindowId: 1,
    windows: {
      1: {
        name: "Window 1",
        panels: { 0: initPanel() },
      },
    },
  },
  reducers: {
    setWindowId: (state, action) => {
      state.currentWindowId = action.payload.windowId;
    },
    addWindow: (state, action) => {
      const windows = state.windows;
      const newKey = Math.max(...Object.keys(windows)) + 1;
      windows[newKey] = {
        name: `Window ${newKey}`,
        panels: { 0: initPanel() },
      };
      state.windows = windows;
      state.currentWindowId = newKey;
    },
    updateWindows: (state, action) => {
      state.windows = action.payload.windows;
      state.currentWindowId = action.payload.currentWindowId;
    },
    deleteWindow: (state, action) => {
      delete state.windows[action.payload.windowId];
      state.currentWindowId = Object.keys(state.windows)[0];
    },
    renameWindow: (state, action) => {
      state.windows[state.currentWindowId].name = action.payload.name;
    },
    clearPanels: (state) => {
      state.windows[state.currentWindowId].panels = {};
    },
    addPanel: (state) => {
      const panels = state.windows[state.currentWindowId].panels;
      var newKey, newY;
      if (Object.keys(panels).length === 0) {
        newKey = 0;
        newY = 0;
      } else {
        newKey = Math.max(...Object.keys(panels)) + 1;
        newY = Math.max(...Object.values(panels).map((x) => x.dataGrid.y)) + 1;
      }
      panels[newKey] = initPanel({ y: newY });
      state.windows[state.currentWindowId].panels = panels;
    },
    deletePanel: (state, action) => {
      const panels = state.windows[state.currentWindowId].panels;
      if(Object.entries(panels).length > 1) {
        delete panels[action.payload.panelId];
      }
    },
    updatePanels: (state, action) => {
      state.windows[state.currentWindowId].panels = action.payload.panels;
    },
    updatePanelState: (state, action) => {
      const panels = state.windows[state.currentWindowId].panels;
      panels[action.payload.panelId].channel = action.payload.channel;
      panels[action.payload.panelId].state = action.payload.state;
    },
  },
});

export const {
  addPanel,
  setWindowId,
  addWindow,
  updateWindows,
  deleteWindow,
  renameWindow,
  clearPanels,
  deletePanel,
  updatePanels,
  updatePanelState,
} = panelSlice.actions;

export default panelSlice.reducer;
