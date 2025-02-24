import React from "react";
import AppBar from "./appbar/AppBar";
import Login from "./Login";
import PanelGrid from "./PanelGrid";

const Main = () => {
  return (
    <>
      <Login>
        <PanelGrid />
      </Login>
      <AppBar />
    </>
  );
};

export default Main;
