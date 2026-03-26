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
import Typography from "@mui/material/Typography";

import { listenChannels, adminDeleteChannel } from "../../util/connection";

const ChannelDialog = ({ open, setOpen }) => {
  const credentials = useSelector((state) => state.credentials.credentials);
  const sessionId = useSelector((state) => state.credentials.sessionId);

  const [channels, setChannels] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [success, setSuccess] = React.useState(null);
  const [confirmDelete, setConfirmDelete] = React.useState(null);

  React.useEffect(() => {
    if (open) {
      listenChannels(setChannels);
      setSuccess(null);
      setError(null);
      setConfirmDelete(null);
    }
  }, [open]);

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
            {channels.map((ch) => (
              <ListItem
                key={ch}
                secondaryAction={
                  confirmDelete === ch ? (
                    <Box>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleDelete(ch)}
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
                    <IconButton
                      edge="end"
                      onClick={() => setConfirmDelete(ch)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  )
                }
              >
                <ListItemText primary={ch} />
              </ListItem>
            ))}
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
