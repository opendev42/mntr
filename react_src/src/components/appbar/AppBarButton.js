import React from "react";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";

const AppBarButton = ({ title, onClick, icon, sx }) => {
  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        edge="start"
        color="inherit"
        sx={{ mr: 2, ...sx }}
        onClick={onClick}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
};

export default AppBarButton;
