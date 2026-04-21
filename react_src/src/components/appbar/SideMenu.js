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
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import PersonIcon from "@mui/icons-material/Person";
import PeopleIcon from "@mui/icons-material/People";
import DnsIcon from "@mui/icons-material/Dns";
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import ComputerIcon from '@mui/icons-material/Computer';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';

import AppBarButton from "./AppBarButton";
import AdminDialog from "./AdminDialog";
import ChannelDialog from "./ChannelDialog";

import { updateWindows } from "../../state/panelSlice";
import { removeCredentials } from "../../state/credentialsSlice";
import { setStayLoggedIn } from "../../state/credentialStorage";
import { setMobile, removeMobile } from "../../state/mobileSlice";
import { setDark, setLight } from "../../state/themeSlice";

const SideMenu = () => {
  const layoutState = useSelector((state) => state.panel);
  const isMobile = useSelector((state) => state.mobile.isMobile);
  const isDark = useSelector((state) => state.theme?.isDark ?? false);
  const isAdmin = useSelector((state) => state.credentials.isAdmin);
  const credentials = useSelector((state) => state.credentials.credentials);

  const uploadFile = React.useRef(null);
  const dispatch = useDispatch();

  const [showMenu, setShowMenu] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [helpDialogOpen, setHelpDialogOpen] = React.useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = React.useState(false);
  const [channelDialogOpen, setChannelDialogOpen] = React.useState(false);

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
        {credentials && (
          <MenuItem disabled>
            <ListItemIcon><PersonIcon /></ListItemIcon>
            <ListItemText>
              <Typography fontWeight={500}>{credentials.user}</Typography>
            </ListItemText>
          </MenuItem>
        )}
        <Divider />

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

        {isAdmin && (
          <SideMenuItem
            title="Manage Users"
            icon={<PeopleIcon />}
            onClick={() => setAdminDialogOpen(true)}
            closeMenu={() => setShowMenu(false)}
          />
        )}

        {isAdmin && (
          <SideMenuItem
            title="Manage Channels"
            icon={<DnsIcon />}
            onClick={() => setChannelDialogOpen(true)}
            closeMenu={() => setShowMenu(false)}
          />
        )}

        <SideMenuItem
          title={isDark ? "Light Mode" : "Dark Mode"}
          icon={isDark ? <LightModeIcon /> : <DarkModeIcon />}
          onClick={() => dispatch((isDark ? setLight : setDark)())}
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
      {isAdmin && <AdminDialog open={adminDialogOpen} setOpen={setAdminDialogOpen} />}
      {isAdmin && <ChannelDialog open={channelDialogOpen} setOpen={setChannelDialogOpen} />}
      <input
        type="file"
        id="file"
        ref={uploadFile}
        style={{ display: "none" }}
        onChange={(e) => {
          var reader = new FileReader();
          reader.onload = () => {
            try {
              dispatch(updateWindows(JSON.parse(reader.result)));
            } catch {
              // invalid layout file — ignore
            }
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
const HelpSection = ({ title, children }) => (
  <>
    <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }} fontWeight={600}>
      {title}
    </Typography>
    {children}
  </>
);

const HelpItem = ({ primary, secondary }) => (
  <Typography variant="body2" sx={{ pl: 1, mb: 0.5 }} color="text.secondary">
    <strong>{primary}</strong> {secondary && `\u2014 ${secondary}`}
  </Typography>
);

const HelpDialog = ({ open, setOpen }) => {
  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>Help</DialogTitle>
      <DialogContent>
        <HelpSection title="Panels">
          <HelpItem primary="Add panel" secondary='click the "+" button in the bottom bar.' />
          <HelpItem primary="Select channel" secondary="use the dropdown at the top of each panel to choose a channel." />
          <HelpItem primary="Move panels" secondary="Ctrl-click and drag a panel to reposition it." />
          <HelpItem primary="Resize panels" secondary="drag the bottom-right corner of a panel." />
          <HelpItem primary="Close panel" secondary='click the "X" button on the panel.' />
        </HelpSection>

        <HelpSection title="Windows">
          <HelpItem primary="Switch windows" secondary="click the window name in the bottom bar to open the window menu." />
          <HelpItem primary="Add window" secondary='use the "New window" option in the window menu.' />
          <HelpItem primary="Rename window" secondary="click the edit icon next to a window name in the menu." />
          <HelpItem primary="Clear panels" secondary="removes all panels from the current window." />
          <HelpItem primary="Close window" secondary="removes the window and all its panels." />
        </HelpSection>

        <HelpSection title="Layout">
          <HelpItem primary="Download layout" secondary="saves your current panel arrangement as a JSON file." />
          <HelpItem primary="Upload layout" secondary="restores a previously saved layout from a JSON file." />
          <HelpItem primary="Mobile / Desktop mode" secondary="switches between single-panel and multi-panel grid views." />
          <HelpItem primary="Dark / Light mode" secondary="toggles the color theme." />
        </HelpSection>

        <HelpSection title="Admin (admin users only)">
          <HelpItem primary="Manage Users" secondary="add or remove users, and assign group memberships." />
          <HelpItem primary="Manage Channels" secondary="delete channels, and set read/write group permissions." />
        </HelpSection>

        <HelpSection title="Channels & Groups">
          <HelpItem primary="Groups" secondary="users belong to groups. Channels can be restricted so only certain groups can see or publish to them." />
          <HelpItem primary="Read groups" secondary="control who can see and subscribe to a channel." />
          <HelpItem primary="Write groups" secondary="control who can publish data to a channel." />
          <HelpItem primary="No restriction" secondary="channels without group permissions are visible to all users." />
        </HelpSection>
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
            setStayLoggedIn(false);
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
