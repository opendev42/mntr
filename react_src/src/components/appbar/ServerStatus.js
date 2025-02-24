import React from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { listenHeartbeat } from "../../util/connection";

const ServerStatus = () => {
  const [heartbeat, setHeartbeat] = React.useState(0);
  const [heartbeatCheck, setHeartbeatCheck] = React.useState(null);

  React.useEffect(() => {
    listenHeartbeat(setHeartbeat);

    const interval = setInterval(() => {
      setHeartbeatCheck(Date.now() / 1000);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ m: 0, mr: 3 }}>
      <StatusDot
        secondsSinceUpdate={heartbeatCheck - heartbeat}
        tolerance={5}
      />
    </Box>
  );
};

const StatusDot = ({ secondsSinceUpdate, tolerance }) => {
  const title =
    secondsSinceUpdate < tolerance
      ? "Server OK"
      : `Server down. Last update ${Math.floor(secondsSinceUpdate)}s ago`;
  return (
    <Tooltip title={title}>
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: secondsSinceUpdate < tolerance ? "#0f0" : "#f00",
        }}
      />
    </Tooltip>
  );
};

export default ServerStatus;
