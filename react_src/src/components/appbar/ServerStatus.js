import React from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { listenHeartbeat } from "../../util/connection";

const ServerStatus = () => {
  const [heartbeat, setHeartbeat] = React.useState(null);
  const [now, setNow] = React.useState(Date.now() / 1000);

  React.useEffect(() => {
    listenHeartbeat(setHeartbeat);

    const interval = setInterval(() => {
      setNow(Date.now() / 1000);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const secondsSinceUpdate = heartbeat === null ? null : now - heartbeat;

  return (
    <Box sx={{ m: 0, mr: 3 }}>
      <StatusDot
        secondsSinceUpdate={secondsSinceUpdate}
        tolerance={5}
      />
    </Box>
  );
};

const StatusDot = ({ secondsSinceUpdate, tolerance }) => {
  const connected = secondsSinceUpdate !== null && secondsSinceUpdate < tolerance;
  const title =
    secondsSinceUpdate === null
      ? "Connecting..."
      : connected
        ? "Server OK"
        : `Server down. Last update ${Math.floor(secondsSinceUpdate)}s ago`;
  const color =
    secondsSinceUpdate === null ? "#ff9800" : connected ? "#4caf50" : "#f44336";
  return (
    <Tooltip title={title}>
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
    </Tooltip>
  );
};

export default ServerStatus;
