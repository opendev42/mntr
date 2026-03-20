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
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

import { adminListUsers, adminAddUser, adminRemoveUser } from "../../util/connection";

const AdminDialog = ({ open, setOpen }) => {
  const credentials = useSelector((state) => state.credentials.credentials);

  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [success, setSuccess] = React.useState(null);
  const [newUser, setNewUser] = React.useState("");
  const [newPassphrase, setNewPassphrase] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(null);

  const fetchUsers = React.useCallback(() => {
    if (!credentials) return;
    setLoading(true);
    adminListUsers(credentials.user, credentials.passphrase)
      .then((data) => {
        setUsers(data.users);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [credentials]);

  React.useEffect(() => {
    if (open) {
      fetchUsers();
      setSuccess(null);
      setError(null);
      setNewUser("");
      setNewPassphrase("");
      setConfirmDelete(null);
    }
  }, [open, fetchUsers]);

  const handleAdd = () => {
    if (!newUser.trim() || !newPassphrase) {
      setError("Username and passphrase are required");
      return;
    }
    setError(null);
    setSuccess(null);
    adminAddUser(credentials.user, credentials.passphrase, newUser.trim(), newPassphrase)
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
    adminRemoveUser(credentials.user, credentials.passphrase, targetUser)
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
                  secondaryAction={
                    confirmDelete === u.user ? (
                      <Box>
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
                      </Box>
                    ) : (
                      u.user !== credentials.user && (
                        <IconButton
                          edge="end"
                          onClick={() => setConfirmDelete(u.user)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )
                    )
                  }
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography>{u.user}</Typography>
                        {u.is_admin && (
                          <Chip label="admin" size="small" color="primary" />
                        )}
                      </Box>
                    }
                  />
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
