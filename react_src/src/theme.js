import { createTheme } from "@mui/material/styles";

const baseComponents = {
  MuiButton: {
    defaultProps: {
      size: "small",
    },
  },
  MuiFilledInput: {
    defaultProps: {
      margin: "dense",
    },
  },
  MuiFormControl: {
    defaultProps: {
      margin: "dense",
    },
  },
  MuiFormHelperText: {
    defaultProps: {
      margin: "dense",
    },
  },
  MuiIconButton: {
    defaultProps: {
      size: "small",
    },
  },
  MuiInputBase: {
    defaultProps: {
      margin: "dense",
    },
  },
  MuiInputLabel: {
    defaultProps: {
      margin: "dense",
    },
  },
  MuiListItem: {
    defaultProps: {
      dense: true,
    },
  },
  MuiOutlinedInput: {
    defaultProps: {
      margin: "dense",
    },
  },
  MuiFab: {
    defaultProps: {
      size: "small",
    },
  },
  MuiTable: {
    defaultProps: {
      size: "small",
    },
  },
  MuiTextField: {
    defaultProps: {
      margin: "dense",
    },
  },
  MuiToolbar: {
    defaultProps: {
      variant: "dense",
    },
  },
};

export const makeTheme = (isDark) =>
  createTheme({
    typography: {
      fontFamily: "Roboto Mono",
    },
    palette: {
      mode: isDark ? "dark" : "light",
      primary: {
        main: "#021b5c",
      },
      ...(isDark && {
        background: {
          default: "#121212",
          paper: "#1e1e1e",
        },
      }),
    },
    components: baseComponents,
  });

export default makeTheme(false);
