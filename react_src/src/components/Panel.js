import React from "react";
import { useSelector, useDispatch } from "react-redux";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Display from "./display/Display";
import { deletePanel, updatePanelState } from "../state/panelSlice";

import { subscribe, listenChannels } from "../util/connection";

const Panel = ({ panelId, credentials }) => {
  const dispatch = useDispatch();
  const [channelData, setChannelData] = React.useState(null);

  const channel = useSelector(
    (state) =>
      state.panel.windows[state.panel.currentWindowId].panels[panelId].channel,
  );
  const state = useSelector(
    (state) =>
      state.panel.windows[state.panel.currentWindowId].panels[panelId].state,
  );

  React.useEffect(() => {
    if (credentials === null) {
      return;
    }

    if ((channel || "") === "") {
      setChannelData(null);
      return;
    }

    return subscribe(
      channel,
      setChannelData,
      credentials.user,
      credentials.passphrase,
    );
  }, [channel, credentials]);

  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        backgroundColor: "#fcfcfc",
        width: "100%",
        height: "100%",
      }}
      onMouseDown={(e) => {
        if (!(e.metaKey || e.ctrlKey)) {
          e.stopPropagation();
        }
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "row" }}>
        <ChannelSelector
          channel={channel}
          setChannel={(channel) => {
            setChannelData(null);
            dispatch(updatePanelState({ panelId, state: {}, channel }));
          }}
          timestamp={channelData !== null ? channelData.timestamp : null}
        />
        <Tooltip title="Close panel">
          <IconButton
            onClick={() => {
              dispatch(deletePanel({ panelId }));
            }}
          >
            <CloseIcon sx={{ fontSize: "0.7rem" }} />
          </IconButton>
        </Tooltip>
      </Box>
      {channel !== "" && channelData === null && (
        <LinearProgress sx={{ mt: 1, mx: 0 }} />
      )}
      {channelData !== null && (
        <Display
          key={channel}
          channelData={channelData.content}
          state={state}
          setState={(newState) => {
            dispatch(
              updatePanelState({
                panelId,
                channel,
                state: newState,
              }),
            );
          }}
        />
      )}
    </Box>
  );
};

const ChannelSelector = ({ channel, setChannel, timestamp }) => {
  const [showTimestamp, setShowTimestamp] = React.useState(false);
  const [channels, setChannels] = React.useState([]);
  React.useEffect(() => {
    listenChannels((c) => {
      const sorted = [...c];
      sorted.sort();
      setChannels(sorted);
    });
  }, []);

  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    setAge(formatAge(timestamp));
    const intervalId = setInterval(() => {
      setAge(formatAge(timestamp));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timestamp]);

  const [age, setAge] = React.useState(null);
  const formatAge = (ts) => {
    if (ts === null) {
      return "";
    }
    const seconds = Math.floor(Date.now() / 1000 - ts);

    if (seconds < 60) {
      const n = 10 * Math.ceil((0.1 + seconds) / 10);
      return `updated < ${n}s ago`;
    }

    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `updated > ${minutes}m ago`;
    } else if (seconds < 24 * 3600) {
      const hours = Math.floor(seconds / 3600);
      return `updated > ${hours}h ago`;
    }
    const days = Math.floor(seconds / (24 * 3600));
    return `updated ${days}d ago`;
  };

  return (
    <Box
      sx={{
        m: 0.5,
        mb: 0,
        flex: 1,
      }}
      onMouseOver={() => setShowTimestamp(true)}
      onMouseOut={() => setShowTimestamp(false)}
    >
      <Autocomplete
        size="small"
        options={["", ...channels]}
        defaultValue={channel}
        value={
          (channel || "") === ""
            ? ""
            : focused
              ? channel
              : showTimestamp
                ? `${channel} / updated ${Date(timestamp)}`
                : `${channel} / ${age}`
        }
        onChange={(e, v) => {
          setChannel(v);
        }}
        sx={{
          p: 0,
          m: 0,
        }}
        clearIcon={null}
        popupIcon={null}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            variant="standard"
            placeholder="Select channel"
            autoComplete="off"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            InputProps={{
              ...params.InputProps,
              disableUnderline: true,
              style: {
                fontSize: "0.7rem",
                color: focused ? "#000" : "#888",
              },
            }}
            sx={{
              p: 0,
              m: 0,
            }}
          />
        )}
      />
    </Box>
  );
};

export default Panel;
