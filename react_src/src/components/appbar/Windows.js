import React from "react";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import LibraryAddIcon from "@mui/icons-material/LibraryAdd";
import EditIcon from "@mui/icons-material/Edit";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useSelector, useDispatch } from "react-redux";

import {
  deleteWindow,
  addWindow,
  setWindowId,
  renameWindow,
  clearPanels,
} from "../../state/panelSlice";

const Windows = () => {
  const dispatch = useDispatch();
  const [showMenu, setShowMenu] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [showRenameDialog, setShowRenameDialog] = React.useState(false);
  const [showCloseDialog, setShowCloseDialog] = React.useState(false);
  const [showClearPanelsDialog, setShowClearPanelsDialog] =
    React.useState(false);

  const currentWindowId = useSelector((state) => state.panel.currentWindowId);
  const currentWindow = useSelector(
    (state) => state.panel.windows[state.panel.currentWindowId],
  );
  const windows = useSelector((state) => state.panel.windows);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        mr: 2,
      }}
    >
      <Menu
        open={showMenu}
        onClose={() => setShowMenu(false)}
        anchorEl={anchorEl}
      >
        <MenuItem disabled>Windows</MenuItem>
        {Object.entries(windows).map(([windowId, window_]) => {
          return (
            <WindowMenuItem
              key={windowId}
              onClick={() => {
                dispatch(setWindowId({ windowId }));
                setShowMenu(false);
              }}
              icon={<KeyboardArrowRightIcon />}
              text={window_.name}
              selected={windowId === currentWindowId}
            />
          );
        })}
        <Divider />
        <MenuItem disabled>Current: {currentWindow.name}</MenuItem>
        <RenameWindow
          windowName={currentWindow.name}
          closeMenu={() => setShowMenu(false)}
          setShowDialog={setShowRenameDialog}
        />
        {Object.keys(windows).length > 1 && (
          <WindowMenuItem
            onClick={() => {
              setShowCloseDialog(true);
              setShowMenu(false);
            }}
            icon={<CloseIcon />}
            text="Close"
          />
        )}
        <WindowMenuItem
          onClick={() => {
            setShowClearPanelsDialog(true);
            setShowMenu(false);
          }}
          icon={<ClearAllIcon />}
          text="Clear panels"
        />
        <Divider />
        <WindowMenuItem
          onClick={() => {
            setShowMenu(false);
            dispatch(addWindow());
          }}
          icon={<LibraryAddIcon />}
          text="New window"
        />
      </Menu>
      <Tooltip title="Window">
        <Button
          style={{
            color: "#fff",
            fontWeight: 900,
            fontSize: "1rem",
            fontFamily: "Roboto Mono",
            textTransform: "none",
          }}
          onClick={(e) => {
            setShowMenu(true);
            setAnchorEl(e.currentTarget);
          }}
        >
          {currentWindow.name}
        </Button>
      </Tooltip>
      <RenameDialog
        windowName={currentWindow.name}
        showDialog={showRenameDialog}
        setShowDialog={setShowRenameDialog}
      />
      <CloseDialog
        windowName={currentWindow.name}
        currentWindowId={currentWindowId}
        showDialog={showCloseDialog}
        setShowDialog={setShowCloseDialog}
      />
      <ClearPanelsDialog
        showDialog={showClearPanelsDialog}
        setShowDialog={setShowClearPanelsDialog}
        windowName={currentWindow.name}
      />
    </Box>
  );
};

const WindowMenuItem = ({ icon, text, onClick, disabled, selected }) => {
  return (
    <MenuItem onClick={onClick} disabled={disabled} selected={selected}>
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText>{text}</ListItemText>
    </MenuItem>
  );
};

const CloseDialog = ({
  windowName,
  currentWindowId,
  showDialog,
  setShowDialog,
}) => {
  const dispatch = useDispatch();
  return (
    <Dialog open={showDialog}>
      <DialogTitle>Close {windowName}?</DialogTitle>
      <DialogContent>
        <Typography>This action cannot be undone.</Typography>
      </DialogContent>
      <DialogActions>
        <Button
          variant="standard"
          onClick={() => {
            setShowDialog(false);
            dispatch(deleteWindow({ windowId: currentWindowId }));
          }}
        >
          Confirm
        </Button>
        <Button
          variant="standard"
          onClick={() => {
            setShowDialog(false);
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ClearPanelsDialog = ({ showDialog, setShowDialog, windowName }) => {
  const dispatch = useDispatch();
  return (
    <Dialog open={showDialog}>
      <DialogTitle>Clear all panels in {windowName}?</DialogTitle>
      <DialogContent>
        <Typography>This action cannot be undone.</Typography>
      </DialogContent>
      <DialogActions>
        <Button
          variant="standard"
          onClick={() => {
            dispatch(clearPanels());
            setShowDialog(false);
          }}
        >
          Confirm
        </Button>
        <Button
          variant="standard"
          onClick={() => {
            setShowDialog(false);
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const RenameDialog = ({ windowName, showDialog, setShowDialog }) => {
  const dispatch = useDispatch();
  const [newName, setNewName] = React.useState(windowName);
  return (
    <Dialog
      open={showDialog}
      PaperProps={{
        sx: {
          width: "100%",
        },
      }}
    >
      <DialogTitle>Rename {windowName}</DialogTitle>
      <DialogContent>
        <TextField
          sx={{ width: "100%" }}
          aria-label="Window name"
          placeholder="Window name"
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="standard"
          onClick={() => {
            dispatch(renameWindow({ name: newName }));
            setNewName("");
            setShowDialog(false);
          }}
        >
          Rename
        </Button>
        <Button
          variant="standard"
          onClick={() => {
            setShowDialog(false);
            setNewName(windowName);
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const RenameWindow = ({ windowName, closeMenu, setShowDialog }) => {
  return (
    <>
      <WindowMenuItem
        onClick={() => {
          setShowDialog(true);
          closeMenu();
        }}
        icon={<EditIcon />}
        text="Rename"
      />
    </>
  );
};

export default Windows;
