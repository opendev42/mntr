import React from "react";
import Box from "@mui/material/Box";
import MuiAppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import ServerStatus from "./ServerStatus";
import AddPanel from "./AddPanel";
import Windows from "./Windows";
import SideMenu from "./SideMenu";

import { useSelector } from "react-redux";

const AppBar = () => {
  const isMobile = useSelector((state) => state.mobile.isMobile);
  const [time, setTime] = React.useState(Date(Date.now()));

  React.useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date(Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <MuiAppBar
      position="fixed"
      sx={{
        m: 0,
        bottom: 0,
        top: "auto",
        backgroundColor: "primary",
      }}
    >
      <Toolbar>
        <Box
          sx={{
            display: "flex",
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          <ServerStatus />
          <Typography
            sx={{ mr: 4 }}
            style={{ fontSize: "0.85rem" }}
            fontWeight={400}
            fontFamily="Roboto Mono"
          >
            {time}
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            flex: 1,
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <Windows />
          {isMobile === 0 && <AddPanel />}
          <SideMenu />
        </Box>
      </Toolbar>
    </MuiAppBar>
  );
};

export default AppBar;
