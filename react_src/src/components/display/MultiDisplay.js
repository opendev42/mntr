import React from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import UpdateIcon from "@mui/icons-material/Update";
import Input from "@mui/material/Input";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Display from "./Display";

// TODO: cleanup

const MultiDisplay = ({ data, state, setState }) => {
  const [selected, setSelected] = React.useState(null);
  const [cycleConfig, setCycleConfig_] = React.useState(
    state.cycleConfig || {
      enabled: false,
      interval: 5,
      options: Object.keys(data),
    },
  );
  const [showCycleConfig, setShowCycleConfig] = React.useState(null);

  const setCycleConfig = (x) => {
    setCycleConfig_(x);
    setState({ ...state, cycleConfig });
  };

  React.useEffect(() => {
    setSelected(
      Object.keys(data).includes(state.__multiSelect)
        ? state.__multiSelect
        : Object.keys(data)[0],
    );
  }, [data, state, setSelected]);

  React.useEffect(() => {
    if (cycleConfig !== null && cycleConfig.enabled) {
      const options = cycleConfig.options;

      var i = 0;
      const timeoutId = setInterval(() => {
        i += 1;
        setSelected(options[i % options.length]);
      }, 1000 * cycleConfig.interval);

      return () => {
        clearInterval(timeoutId);
      };
    }
  }, [cycleConfig, setSelected]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        m: 0,
        flex: 1,
      }}
    >
      {selected !== null && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
          }}
        >
          <Select
            sx={{
              fontSize: "0.6rem",
              px: 0.5,
              py: 0.0,
              mb: 0.5,
              borderRadius: 1,
              flex: 5,
            }}
            input={
              <Input
                style={{
                  backgroundColor: "#f4f4f4",
                }}
                disableUnderline
              />
            }
            disabled={cycleConfig.enabled || showCycleConfig}
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setState({ ...state, __multiSelect: e.target.value });
            }}
          >
            {Object.keys(data).map((x) => (
              <MenuItem key={x} value={x}>
                {x}
              </MenuItem>
            ))}
          </Select>

          <Tooltip title="Previous">
            <IconButton
              onClick={() => {
                const current = Object.keys(data).indexOf(selected);
                const updated = Math.max(0, current - 1);
                setSelected(Object.keys(data)[updated]);
              }}
              disabled={cycleConfig.enabled || showCycleConfig}
            >
              <KeyboardArrowUpIcon sx={{ fontSize: "1.2rem" }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Next">
            <IconButton
              onClick={() => {
                const current = Object.keys(data).indexOf(selected);
                const updated = Math.min(
                  Object.keys(data).length - 1,
                  current + 1,
                );
                setSelected(Object.keys(data)[updated]);
              }}
              disabled={cycleConfig.enabled || showCycleConfig}
            >
              <KeyboardArrowDownIcon sx={{ fontSize: "1.2rem" }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Cycle">
            <IconButton
              onClick={() => {
                if (showCycleConfig) {
                  setCycleConfig(cycleConfig);
                }
                setShowCycleConfig(!showCycleConfig);
              }}
            >
              <UpdateIcon sx={{ fontSize: "1.2rem" }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      {showCycleConfig && (
        <CycleConfig
          options={Object.keys(data)}
          cycleConfig={cycleConfig}
          setCycleConfig={setCycleConfig}
          setShowCycleConfig={setShowCycleConfig}
        />
      )}
      {!showCycleConfig && (
        <>
          {(data[selected] || null) !== null && (
            <Display channelData={data[selected]} sxOverrides={{ m: 0 }} />
          )}
        </>
      )}
    </Box>
  );
};

const CycleConfig = ({ options, cycleConfig, setCycleConfig }) => {
  const [selections, setSelections] = React.useState(
    cycleConfig !== null
      ? options.map((x) => cycleConfig.options.includes(x))
      : options.map((x) => true),
  );

  return (
    <>
      <FormControl>
        <List>
          <ListItem>
            <FormControlLabel
              label="Cycle through displays"
              control={
                <Switch
                  checked={cycleConfig.enabled}
                  onChange={(e) => {
                    setCycleConfig({
                      ...cycleConfig,
                      enabled: e.target.checked,
                    });
                  }}
                />
              }
            />
          </ListItem>
          {cycleConfig.enabled && (
            <>
              <Divider sx={{ my: 1 }} />
              <ListItem>
                <FormLabel>Interval (seconds)</FormLabel>
              </ListItem>
              <ListItem>
                <TextField
                  id="outlined-number"
                  type="number"
                  value={cycleConfig.interval}
                  sx={{ p: 0 }}
                  inputProps={{
                    min: 0,
                    sx: { m: 0, p: 1 },
                    style: { fontSize: "0.8rem" },
                  }}
                  slotProps={{
                    inputLabel: {
                      shrink: true,
                    },
                  }}
                  onChange={(e) => {
                    setCycleConfig({
                      ...cycleConfig,
                      interval: e.target.value,
                    });
                  }}
                />
              </ListItem>
              <Divider sx={{ my: 1 }} />
              <ListItem>
                <FormLabel>Displays to cycle</FormLabel>
              </ListItem>
              <ListItem>
                <FormControlLabel
                  label="Select all"
                  control={<Checkbox />}
                  checked={selections.every((x) => x)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelections(options.map((_) => e.target.checked));
                    } else {
                      setSelections(options.map((_, i) => i === 0));
                    }
                    setCycleConfig({ ...cycleConfig, options });
                  }}
                />
              </ListItem>
              {options.map((x, i) => {
                return (
                  <ListItem key={x}>
                    <FormControlLabel
                      label={x}
                      control={<Checkbox checked={selections[i]} />}
                      onChange={(e) => {
                        const update = [...selections].map((y, j) =>
                          j === i ? e.target.checked : y,
                        );
                        setSelections(update);
                        setCycleConfig({
                          ...cycleConfig,
                          options: options.filter((z, k) => update[k]),
                        });
                      }}
                    />
                  </ListItem>
                );
              })}
            </>
          )}
        </List>
      </FormControl>
    </>
  );
};

export default MultiDisplay;
