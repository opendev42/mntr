import React from "react";
import { useSelector, useDispatch } from "react-redux";
import RGL, { WidthProvider } from "react-grid-layout";
import Panel from "./Panel";
import { updatePanels } from "../state/panelSlice";

const ReactGridLayout = WidthProvider(RGL);

const PanelGrid = () => {
  const dispatch = useDispatch();
  const panels = useSelector(
    (state) => state.panel.windows[state.panel.currentWindowId].panels,
  );
  const windowId = useSelector((state) => state.panel.currentWindowId);
  const credentials = useSelector((state) => state.credentials.credentials);

  return (
    <>
      <ReactGridLayout
        className="layout"
        cols={16}
        rowHeight={10}
        onLayoutChange={(e) => {
          const newPanels = {};
          e.forEach((x) => {
            newPanels[x.i] = {
              state: panels[x.i].state,
              channel: panels[x.i].channel,
              dataGrid: x,
            };
          });
          dispatch(updatePanels({ panels: newPanels }));
        }}
        style={{ marginBottom: 50 }}
      >
        {Object.entries(panels).map(([k, v]) => (
          <div key={k} className="panel" data-grid={v.dataGrid}>
            <Panel
              key={`${windowId}_${k}`}
              panelId={k}
              credentials={credentials}
            />
          </div>
        ))}
      </ReactGridLayout>
    </>
  );
};

export default PanelGrid;
