import React from "react";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";

const ErrorDisplay = ({ data }) => {
  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
      }}
    >
      <Alert severity="error">{data.message}</Alert>
    </Box>
  );
};

export default ErrorDisplay;
