const STAY_LOGGED_IN_KEY = "stayLoggedIn";

export const setStayLoggedIn = (value) => {
  if (value) {
    localStorage.setItem(STAY_LOGGED_IN_KEY, "true");
  } else {
    localStorage.removeItem(STAY_LOGGED_IN_KEY);
  }
};

export const getStayLoggedIn = () =>
  localStorage.getItem(STAY_LOGGED_IN_KEY) === "true";

const credentialStorage = {
  getItem: (key) => {
    const session = sessionStorage.getItem(key);
    if (session !== null) return Promise.resolve(session);
    if (getStayLoggedIn()) return Promise.resolve(localStorage.getItem(key));
    return Promise.resolve(null);
  },
  setItem: (key, value) => {
    sessionStorage.setItem(key, value);
    if (getStayLoggedIn()) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
    return Promise.resolve();
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    return Promise.resolve();
  },
};

export default credentialStorage;
