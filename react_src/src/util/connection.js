import { v4 as uuidv4 } from "uuid";
import { aesDecrypt } from "./encryption";

const API_URL = process.env.REACT_APP_API_URL || "";

var SERVER_STREAM = null;
var CHANNEL_STREAM = null;
const SUBSCRIPTIONS = {};
var CHANNELS = [];
var CHANNELS_CALLBACK = {};
var HEARTBEAT_CALLBACK = null;

const initServerStream = () => {
  if (SERVER_STREAM !== null) {
    return;
  }

  SERVER_STREAM = new EventSource(`${API_URL}/server`);

  SERVER_STREAM.onmessage = (e) => {
    const response = JSON.parse(e.data);
    if (response.type === "channels") {
      CHANNELS = response.data;
      Object.values(CHANNELS_CALLBACK).forEach((c) => {
        c(CHANNELS);
      });
    }

    if (response.type === "heartbeat" && HEARTBEAT_CALLBACK !== null) {
      HEARTBEAT_CALLBACK(response.data);
    }
  };

  SERVER_STREAM.onerror = (e) => {
    SERVER_STREAM.close();
    SERVER_STREAM = null;
    setTimeout(() => {
      initServerStream();
    }, 1000);
  };
};

const listenChannels = (callback) => {
  initServerStream();
  const uuid = uuidv4();
  CHANNELS_CALLBACK[uuid] = callback;
  callback(CHANNELS);
};

const listenHeartbeat = (callback) => {
  initServerStream();
  HEARTBEAT_CALLBACK = callback;
};

const subscribe = (channel, callback, user, passphrase) => {
  const uuid = uuidv4();
  SUBSCRIPTIONS[uuid] = { channel, callback };

  updateStream(user, passphrase);

  return () => {
    delete SUBSCRIPTIONS[uuid];
    updateStream(user, passphrase);
  };
};

const updateStream = (user, passphrase) => {
  if (CHANNEL_STREAM !== null) {
    CHANNEL_STREAM.close();
  }

  const channels = Object.values(SUBSCRIPTIONS)
    .map((x) => x.channel)
    .join(",");

  if (channels === "") {
    return;
  }

  CHANNEL_STREAM = new EventSource(
    `${API_URL}/subscribe/${user}/${channels}`,
    {},
  );

  CHANNEL_STREAM.onmessage = (e) => {
    const raw = JSON.parse(e.data);

    var content;

    try {
      content = JSON.parse(aesDecrypt(raw.data.content, passphrase));
    } catch (error) {
      content = {
        display_type: "error",
        data: { message: "Error in decryption" },
      };
    }

    Object.values(SUBSCRIPTIONS).forEach((s) => {
      if (s.channel === raw.channel) {
        s.callback({ ...raw.data, content });
      }
    });
  };
};

const validateUser = (user, passphrase) => {
  return new Promise((resolve, reject) => {
    fetch(`${API_URL}/validate/${user}`)
      .then((response) => {
        if (response.ok) {
          response.json().then((e) => {
            var decrypted;
            try {
              decrypted = JSON.parse(aesDecrypt(e.message, passphrase));
            } catch {
              reject("Invalid user/passphrase");
              return;
            }
            if (decrypted.subscriber === user) {
              resolve();
            }
          });
        } else {
          response.text().then((e) => {
            reject(e);
          });
        }
      })
      .catch((e) => {
        reject("Request failed");
      });
  });
};

export {
  subscribe,
  listenChannels,
  listenHeartbeat,
  validateUser,
};