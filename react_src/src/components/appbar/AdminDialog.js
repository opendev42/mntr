import React from "react";
import { useSelector } from "react-redux";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
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
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

import {
  adminListUsers,
  adminAddUser,
  adminRemoveUser,
  adminSetUserGroups,
} from "../../util/connection";

const AdminDialog = ({ open, setOpen }) => {
  const credentials = useSelector((state) => state.credentials.credentials);
  const sessionId = useSelector((state) => state.credentials.sessionId);

  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [success, setSuccess] = React.useState(null);
  const [newUser, setNewUser] = React.useState("");
  const [newPassphrase, setNewPassphrase] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  const [editingGroups, setEditingGroups] = React.useState(null);
  const [editGroupsValue, setEditGroupsValue] = React.useState("");

  const fetchUsers = React.useCallback(() => {
    if (!credentials || !sessionId) return;
    setLoading(true);
    adminListUsers(sessionId, credentials.passphrase)
      .then((data) => {
        setUsers(data.users);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [credentials, sessionId]);

  React.useEffect(() => {
    if (open) {
      fetchUsers();
      setSuccess(null);
      setError(null);
      setNewUser("");
      setNewPassphrase("");
      setConfirmDelete(null);
      setEditingGroups(null);
    }
  }, [open, fetchUsers]);

  const handleAdd = () => {
    if (!newUser.trim() || !newPassphrase) {
      setError("Username and passphrase are required");
      return;
    }
    setError(null);
    setSuccess(null);
    adminAddUser(sessionId, credentials.passphrase, newUser.trim(), newPassphrase)
      .then(() => {
        setSuccess(`User "${newUser.trim()}" added`);
        setNewUser("");
        setNewPassphrase("");
        fetchUsers();
      })
      .catch((e) => setError(String(e)));
  };

  const handleRemove = (targetUser) => {
    setError(null);
    setSuccess(null);
    adminRemoveUser(sessionId, credentials.passphrase, targetUser)
      .then(() => {
        setSuccess(`User "${targetUser}" removed`);
        setConfirmDelete(null);
        fetchUsers();
      })
      .catch((e) => {
        setError(String(e));
        setConfirmDelete(null);
      });
  };

  const startEditGroups = (user) => {
    setEditingGroups(user.user);
    setEditGroupsValue(user.groups.join(", "));
    setError(null);
    setSuccess(null);
  };

  const cancelEditGroups = () => {
    setEditingGroups(null);
    setEditGroupsValue("");
  };

  const saveGroups = (targetUser) => {
    const groups = editGroupsValue
      .split(/[,\s]+/)
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
    setError(null);
    setSuccess(null);
    adminSetUserGroups(sessionId, credentials.passphrase, targetUser, groups)
      .then(() => {
        setSuccess(`Groups updated for "${targetUser}"`);
        setEditingGroups(null);
        setEditGroupsValue("");
        fetchUsers();
      })
      .catch((e) => setError(String(e)));
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Manage Users</DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress />
          </Box>
        )}
        {!loading && (
          <>
            <List dense>
              {users.map((u) => (
                <ListItem
                  key={u.user}
                  sx={{ flexDirection: "column", alignItems: "stretch" }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <Typography>{u.user}</Typography>
                          {u.is_admin && (
                            <Chip label="admin" size="small" color="primary" />
                          )}
                        </Box>
                      }
                    />
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      {confirmDelete === u.user ? (
                        <>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleRemove(u.user)}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="small"
                            onClick={() => setConfirmDelete(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        u.user !== credentials.user && (
                          <IconButton
                            size="small"
                            onClick={() => setConfirmDelete(u.user)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )
                      )}
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      pl: 2,
                      pb: 0.5,
                    }}
                  >
                    {editingGroups === u.user ? (
                      <>
                        <TextField
                          size="small"
                          variant="standard"
                          placeholder="group1, group2, ..."
                          value={editGroupsValue}
                          onChange={(e) => setEditGroupsValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveGroups(u.user);
                            if (e.key === "Escape") cancelEditGroups();
                          }}
                          sx={{ flex: 1 }}
                          autoFocus
                        />
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => saveGroups(u.user)}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={cancelEditGroups}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mr: 0.5 }}
                        >
                          groups:
                        </Typography>
                        {u.groups.length > 0 ? (
                          u.groups.map((g) => (
                            <Chip
                              key={g}
                              label={g}
                              size="small"
                              variant="outlined"
                            />
                          ))
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            none
                          </Typography>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => startEditGroups(u)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                mt: 2,
              }}
            >
              <TextField
                size="small"
                placeholder="Username"
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
              />
              <TextField
                size="small"
                placeholder="Passphrase"
                type="password"
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
              />
              <Button variant="contained" size="small" onClick={handleAdd}>
                Add
              </Button>
            </Box>
          </>
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

export default AdminDialog;
