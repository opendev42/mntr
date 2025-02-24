import React from "react";
import { useSelector, useDispatch } from "react-redux";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { validateUser } from "../util/connection";
import { setCredentials } from "../state/credentialsSlice";

const Login = ({ children }) => {
  const dispatch = useDispatch();
  const credentials = useSelector((state) => state.credentials.credentials);

  const [userInput, setUserInput] = React.useState("");
  const [passphraseInput, setPassphraseInput] = React.useState("");
  const [error, setError] = React.useState(null);
  const [validating, setValidating] = React.useState(false);
  const [validated, setValidated] = React.useState(false);

  React.useEffect(() => {
    if (!validated && credentials !== null) {
      validateUser(credentials.user, credentials.passphrase)
        .then(() => {
          setValidating(false);
          setValidated(true);
        })
        .catch((e) => {
          setUserInput(credentials.user);
          setPassphraseInput(credentials.passphrase);
          setError(e);
          setValidating(false);
        });
    }
  }, [credentials, validated]);

  return (
    <>
      {validated && credentials !== null && children}
      {(!validated || credentials === null) && (
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
                  disabled={validating}
                />
                <TextField
                  aria-label="Passphrase"
                  placeholder="Passphrase"
                  value={passphraseInput}
                  type="password"
                  onChange={(e) => setPassphraseInput(e.target.value)}
                  disabled={validating}
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
                    onClick={() => {
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
                        .then(() => {
                          dispatch(
                            setCredentials({
                              credentials: {
                                user: userInput,
                                passphrase: passphraseInput,
                              },
                            }),
                          );
                          setValidating(false);
                          setValidated(true);
                          setUserInput("");
                          setPassphraseInput("");
                        })
                        .catch((e) => {
                          setError(e);
                          setValidating(false);
                        });
                    }}
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
