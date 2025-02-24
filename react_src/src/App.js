import Main from "./components/Main";
import { ThemeProvider } from "@mui/material/styles";
import { store, persistor } from "./state/store";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import "../node_modules/react-grid-layout/css/styles.css";
import "../node_modules/react-resizable/css/styles.css";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto-mono/300.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "@fontsource/roboto-mono/700.css";
import "./styles.css";

import theme from "./theme";

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider theme={theme}>
          <Main />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
