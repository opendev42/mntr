import React from "react";
import { useDispatch, useSelector } from "react-redux";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import DownloadIcon from "@mui/icons-material/Download";
import FileOpenIcon from "@mui/icons-material/FileOpen";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import LogoutIcon from "@mui/icons-material/Logout";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import ComputerIcon from '@mui/icons-material/Computer';

import AppBarButton from "./AppBarButton";

import { updateWindows } from "../../state/panelSlice";
import { removeCredentials } from "../../state/credentialsSlice";
import { setMobile, removeMobile } from "../../state/mobileSlice";

const SideMenu = () => {
  const layoutState = useSelector((state) => state.panel);
  const isMobile = useSelector((state) => state.mobile.isMobile);

  const uploadFile = React.useRef(null);
  const dispatch = useDispatch();

  const [showMenu, setShowMenu] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [helpDialogOpen, setHelpDialogOpen] = React.useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false);

  return (
    <>
      <AppBarButton
        icon={<MenuIcon />}
        title="Menu"
        sx={{
          mr: 0,
        }}
        onClick={(e) => {
          setShowMenu(!showMenu);
          setAnchorEl(e.currentTarget);
        }}
      />
      <Menu
        open={showMenu}
        onClose={() => setShowMenu(false)}
        anchorEl={anchorEl}
      >
        <SideMenuItem
          title="Help"
          icon={<HelpOutlineIcon />}
          onClick={() => setHelpDialogOpen(true)}
          closeMenu={() => setShowMenu(false)}
        />

        <SideMenuItem
          title="Download layout"
          icon={<DownloadIcon />}
          onClick={() => {
            const uri = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(layoutState))}`;
            const link = document.createElement("a");
            link.download = "layout.json";
            link.href = uri;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          closeMenu={() => setShowMenu(false)}
        />

        <SideMenuItem
          title="Upload layout"
          icon={<FileOpenIcon />}
          onClick={() => {
            uploadFile.current.click();
          }}
          closeMenu={() => setShowMenu(false)}
        />

        <SideMenuItem
          title={isMobile ? "Desktop Mode" : "Mobile Mode"}
          icon={isMobile ? <ComputerIcon /> : <PhoneAndroidIcon />}
          onClick={() => dispatch((isMobile ? removeMobile : setMobile)())}
          closeMenu={() => setShowMenu(false)}
        />

        <SideMenuItem
          title="Logout"
          icon={<LogoutIcon />}
          onClick={() => setLogoutDialogOpen(true)}
          closeMenu={() => setShowMenu(false)}
        />
      </Menu>
      <HelpDialog open={helpDialogOpen} setOpen={setHelpDialogOpen} />
      <LogoutDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen} />
      <input
        type="file"
        id="file"
        ref={uploadFile}
        style={{ display: "none" }}
        onChange={(e) => {
          var reader = new FileReader();
          reader.onload = () => {
            dispatch(updateWindows(JSON.parse(reader.result)));
          };
          reader.readAsText(e.target.files[0]);
          uploadFile.current.value = "";
        }}
      />
    </>
  );
};

// menu item
const SideMenuItem = ({ title, icon, onClick, closeMenu }) => {
  return (
    <MenuItem
      onClick={() => {
        onClick();
        closeMenu();
      }}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText>{title}</ListItemText>
    </MenuItem>
  );
};

// help
const HelpDialog = ({ open, setOpen }) => {
  return (
    <Dialog open={open}>
      <DialogTitle>Help</DialogTitle>
      <DialogContent>
        <Typography>
          <li>Ctrl-Click to drag panels.</li>
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          variant="standard"
          onClick={() => {
            setOpen(false);
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// logout
const LogoutDialog = ({ open, setOpen }) => {
  const dispatch = useDispatch();
  return (
    <Dialog open={open}>
      <DialogTitle>Logout?</DialogTitle>
      <DialogActions>
        <Button
          variant="standard"
          onClick={() => {
            dispatch(removeCredentials());
            setOpen(false);
          }}
        >
          Confirm
        </Button>
        <Button
          variant="standard"
          onClick={() => {
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SideMenu;
