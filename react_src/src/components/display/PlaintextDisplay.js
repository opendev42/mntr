import React from "react";
import Typography from "@mui/material/Typography";

const PlaintextDisplay = ({ data }) => {
  return (
    <Typography
      fontSize="small"
      sx={{
        whiteSpace: "pre-line",
      }}
    >
      {data.text}
    </Typography>
  );
};

export default PlaintextDisplay;
