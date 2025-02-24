import React from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import HtmlDisplay from "./HtmlDisplay";
import PlaintextDisplay from "./PlaintextDisplay";
import TableDisplay from "./TableDisplay";
import ImageDisplay from "./ImageDisplay";
import ChartJSDisplay from "./ChartJSDisplay";
import MultiDisplay from "./MultiDisplay";
import ErrorDisplay from "./ErrorDisplay";

const Display = ({ channelData, state, setState, sxOverrides }) => {
  const displayClass = {
    error: ErrorDisplay,
    plaintext: PlaintextDisplay,
    html: HtmlDisplay,
    table: TableDisplay,
    image: ImageDisplay,
    chartjs: ChartJSDisplay,
    multi: MultiDisplay,
    null: NullDisplay,
  }[channelData.display_type || null];

  return (
    <Box
      component="div"
      sx={{
        display: "flex",
        flex: 1,
        m: 0.5,
        overflow: "auto",
        flexDirection: "column",
        ...sxOverrides,
      }}
    >
      {(channelData.alert || null) !== null && (
        <Alert
          severity={channelData.alert.severity}
          sx={{
            py: 0,
            px: 1.5,
            mb: 0.5,
            borderRadius: 2,
          }}
        >
          {(channelData.alert.title || null) !== null && (
            <AlertTitle>{channelData.alert.title}</AlertTitle>
          )}
          {channelData.alert.message}
        </Alert>
      )}
      {channelData.display_type !== null &&
        React.createElement(displayClass, {
          data: channelData.data,
          state,
          setState,
        })}
    </Box>
  );
};

const NullDisplay = ({ data }) => <></>;

export default Display;
