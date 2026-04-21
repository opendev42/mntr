import React from "react";
import { useSelector } from "react-redux";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import {
  listenChannels,
  adminDeleteChannel,
  adminGetChannelPermissions,
  adminSetChannelPermissions,
} from "../../util/connection";

const PermissionRow = ({ label, groups, editing, editValue, onEdit, onSave, onCancel, onChangeValue }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 2, pb: 0.5 }}>
    {editing ? (
      <>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, minWidth: 40 }}>
          {label}:
        </Typography>
        <TextField
          size="small"
          variant="standard"
          placeholder="group1, group2, ... (empty = all)"
          value={editValue}
          onChange={(e) => onChangeValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          sx={{ flex: 1 }}
          autoFocus
        />
        <IconButton size="small" color="primary" onClick={onSave}>
          <CheckIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onCancel}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </>
    ) : (
      <>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, minWidth: 40 }}>
          {label}:
        </Typography>
        {groups && groups.length > 0 ? (
          groups.map((g) => (
            <Chip key={g} label={g} size="small" variant="outlined" />
          ))
        ) : (
          <Typography variant="caption" color="text.disabled">
            all
          </Typography>
        )}
        <IconButton size="small" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
      </>
    )}
  </Box>
);

const ChannelDialog = ({ open, setOpen }) => {
  const credentials = useSelector((state) => state.credentials.credentials);
  const sessionId = useSelector((state) => state.credentials.sessionId);

  const [channels, setChannels] = React.useState([]);
  const [permissions, setPermissions] = React.useState({});
  const [error, setError] = React.useState(null);
  const [success, setSuccess] = React.useState(null);
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  const [editing, setEditing] = React.useState(null);
  const [editReadValue, setEditReadValue] = React.useState("");
  const [editWriteValue, setEditWriteValue] = React.useState("");

  const fetchPermissions = React.useCallback(() => {
    if (!credentials || !sessionId) return;
    adminGetChannelPermissions(sessionId, credentials.passphrase)
      .then((data) => setPermissions(data.permissions || {}))
      .catch(() => {});
  }, [credentials, sessionId]);

  React.useEffect(() => {
    if (open) {
      listenChannels(setChannels);
      fetchPermissions();
      setSuccess(null);
      setError(null);
      setConfirmDelete(null);
      setEditing(null);
    }
  }, [open, fetchPermissions]);

  const handleDelete = (channel) => {
    if (!credentials || !sessionId) return;
    setError(null);
    setSuccess(null);
    adminDeleteChannel(sessionId, credentials.passphrase, channel)
      .then(() => {
        setSuccess(`Channel "${channel}" deleted`);
        setConfirmDelete(null);
      })
      .catch((e) => {
        setError(String(e));
        setConfirmDelete(null);
      });
  };

  const parseGroups = (value) => {
    const groups = value.split(/[,\s]+/).map((g) => g.trim()).filter((g) => g.length > 0);
    return groups.length > 0 ? groups : null;
  };

  const startEdit = (ch) => {
    const perms = permissions[ch] || {};
    setEditing(ch);
    setEditReadValue((perms.read_groups || []).join(", "));
    setEditWriteValue((perms.write_groups || []).join(", "));
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditReadValue("");
    setEditWriteValue("");
  };

  const savePermissions = (ch) => {
    const readGroups = parseGroups(editReadValue);
    const writeGroups = parseGroups(editWriteValue);
    setError(null);
    setSuccess(null);
    adminSetChannelPermissions(
      sessionId,
      credentials.passphrase,
      ch,
      readGroups,
      writeGroups,
    )
      .then(() => {
        setSuccess(`Permissions updated for "${ch}"`);
        setEditing(null);
        fetchPermissions();
      })
      .catch((e) => setError(String(e)));
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Manage Channels</DialogTitle>
      <DialogContent>
        {channels.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            No active channels
          </Typography>
        ) : (
          <List dense>
            {channels.map((ch) => {
              const perms = permissions[ch] || {};
              const isEditing = editing === ch;
              return (
                <ListItem
                  key={ch}
                  sx={{ flexDirection: "column", alignItems: "stretch" }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                    <ListItemText primary={ch} />
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      {confirmDelete === ch ? (
                        <>
                          <Button size="small" color="error" onClick={() => handleDelete(ch)}>
                            Confirm
                          </Button>
                          <Button size="small" onClick={() => setConfirmDelete(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <IconButton size="small" onClick={() => setConfirmDelete(ch)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  <PermissionRow
                    label="read"
                    groups={perms.read_groups}
                    editing={isEditing}
                    editValue={editReadValue}
                    onEdit={() => startEdit(ch)}
                    onSave={() => savePermissions(ch)}
                    onCancel={cancelEdit}
                    onChangeValue={setEditReadValue}
                  />
                  <PermissionRow
                    label="write"
                    groups={perms.write_groups}
                    editing={isEditing}
                    editValue={editWriteValue}
                    onEdit={() => startEdit(ch)}
                    onSave={() => savePermissions(ch)}
                    onCancel={cancelEdit}
                    onChangeValue={setEditWriteValue}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
        {error && (
          <Alert sx={{ mt: 1 }} severity="error">
            {error}
          </Alert>
        )}
        {success && (
          <Alert sx={{ mt: 1 }} severity="success">
            {success}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="standard" onClick={() => setOpen(false)}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChannelDialog;
