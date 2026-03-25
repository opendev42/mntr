import React from "react";
import { useSelector, useDispatch } from "react-redux";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { validateUser, checkAdmin } from "../util/connection";
import { setCredentials, removeCredentials } from "../state/credentialsSlice";
import { setStayLoggedIn, getStayLoggedIn } from "../state/credentialStorage";

const Login = ({ children }) => {
  const dispatch = useDispatch();
  const credentials = useSelector((state) => state.credentials.credentials);

  const [userInput, setUserInput] = React.useState("");
  const [passphraseInput, setPassphraseInput] = React.useState("");
  const [stayLoggedIn, setStayLoggedInState] = React.useState(getStayLoggedIn);
  const [error, setError] = React.useState(null);
  const [validating, setValidating] = React.useState(false);
  const [validated, setValidated] = React.useState(false);

  const handleStayLoggedInChange = (e) => {
    setStayLoggedIn(e.target.checked);
    setStayLoggedInState(e.target.checked);
  };

  const handleLogin = () => {
    if (userInput === "") {
      setError("User cannot be empty");
      return;
    } else if (passphraseInput === "") {
      setError("Passphrase cannot be empty");
      return;
    }
    setError(null);
    setValidating(true);
    validateUser(userInput, passphraseInput)
      .then((sessionId) =>
        checkAdmin(sessionId, passphraseInput).then((res) => {
          dispatch(
            setCredentials({
              credentials: {
                user: userInput,
                passphrase: passphraseInput,
              },
              isAdmin: res.is_admin,
              sessionId,
            }),
          );
          setValidating(false);
          setValidated(true);
          setUserInput("");
          setPassphraseInput("");
        }),
      )
      .catch((e) => {
        setError(e);
        setValidating(false);
      });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !validating) {
      handleLogin();
    }
  };

  React.useEffect(() => {
    if (!validated && credentials !== null) {
      validateUser(credentials.user, credentials.passphrase)
        .then((sessionId) =>
          checkAdmin(sessionId, credentials.passphrase).then((res) => {
            dispatch(
              setCredentials({
                credentials: {
                  user: credentials.user,
                  passphrase: credentials.passphrase,
                },
                isAdmin: res.is_admin,
                sessionId,
              }),
            );
            setValidating(false);
            setValidated(true);
          }),
        )
        .catch((e) => {
          setUserInput(credentials.user);
          setPassphraseInput(credentials.passphrase);
          dispatch(removeCredentials());
          setError(e);
          setValidating(false);
        });
    }
  }, [credentials, validated]);

  return (
    <>
      {credentials !== null && children}
      {credentials === null && (
        <>
          <Dialog
            open={true}
            PaperProps={{
              sx: {
                width: "100%",
              },
            }}
          >
            <DialogTitle>Authenticate</DialogTitle>
            <DialogContent>
              <Typography>Enter user and passphrase</Typography>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <TextField
                  aria-label="User"
                  placeholder="User"
                  value={userInput}
                  onChange={(e) => {
                    setUserInput(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={validating}
                />
                <TextField
                  aria-label="Passphrase"
                  placeholder="Passphrase"
                  value={passphraseInput}
                  type="password"
                  onChange={(e) => setPassphraseInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={validating}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={stayLoggedIn}
                      onChange={handleStayLoggedInChange}
                      disabled={validating}
                      size="small"
                    />
                  }
                  label="Stay logged in"
                  sx={{ mt: 0.5 }}
                />
              </Box>
              {error !== null && (
                <Alert sx={{ mt: 1 }} severity="error">
                  {error}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              {!validating && (
                <>
                  <Button
                    variant="standard"
                    disabled={validating}
                    onClick={() => {
                      setUserInput("");
                      setPassphraseInput("");
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="standard"
                    disabled={validating}
                    onClick={handleLogin}
                  >
                    Login
                  </Button>
                </>
              )}
              {validating && (
                <Box
                  sx={{
                    flex: 1,
                    mb: 2,
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  <CircularProgress />
                </Box>
              )}
            </DialogActions>
          </Dialog>
        </>
      )}
    </>
  );
};

export default Login;
