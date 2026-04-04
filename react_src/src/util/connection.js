import { v4 as uuidv4 } from "uuid";
import { aesEncrypt, aesEncryptUrlSafe, aesDecrypt } from "./encryption";

const API_URL = process.env.REACT_APP_API_URL || "";

var SERVER_STREAM = null;
var CHANNEL_STREAM = null;
const SUBSCRIPTIONS = {};
var CHANNELS = [];
var CHANNELS_CALLBACK = {};
var HEARTBEAT_CALLBACK = null;

var SESSION_ID = null;
var PASSPHRASE = null;

const initServerStream = () => {
  if (SERVER_STREAM !== null) {
    return;
  }

  if (SESSION_ID === null || PASSPHRASE === null) {
    return;
  }

  SERVER_STREAM = new EventSource(
    `${API_URL}/server/${SESSION_ID}`,
  );

  SERVER_STREAM.onmessage = (e) => {
    const response = JSON.parse(e.data);
    if (response.type === "channels") {
      try {
        CHANNELS = JSON.parse(aesDecrypt(response.data, PASSPHRASE));
      } catch {
        CHANNELS = [];
      }
      Object.values(CHANNELS_CALLBACK).forEach((c) => {
        c(CHANNELS);
      });
    }

    if (response.type === "heartbeat" && HEARTBEAT_CALLBACK !== null) {
      try {
        HEARTBEAT_CALLBACK(JSON.parse(aesDecrypt(response.data, PASSPHRASE)));
      } catch {
        // ignore decryption errors on heartbeat
      }
    }
  };

  SERVER_STREAM.onerror = () => {
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

  const channels = Object.values(SUBSCRIPTIONS).map((x) => x.channel);

  if (channels.length === 0) {
    return;
  }

  const encryptedChannels = aesEncryptUrlSafe(
    JSON.stringify(channels),
    passphrase,
  );

  CHANNEL_STREAM = new EventSource(
    `${API_URL}/subscribe/${SESSION_ID}/${encryptedChannels}`,
    {},
  );

  CHANNEL_STREAM.onmessage = (e) => {
    const raw = JSON.parse(e.data);

    var decrypted;
    try {
      decrypted = JSON.parse(aesDecrypt(raw.data, passphrase));
    } catch {
      decrypted = {
        channel: "unknown",
        content: { display_type: "error", data: { message: "Error in decryption" } },
        timestamp: null,
        publisher: null,
      };
    }

    Object.values(SUBSCRIPTIONS).forEach((s) => {
      if (s.channel === decrypted.channel) {
        s.callback({
          content: decrypted.content,
          timestamp: decrypted.timestamp,
          publisher: decrypted.publisher,
        });
      }
    });
  };
};

const generateNonce = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const validateUser = (user, passphrase) => {
  return new Promise((resolve, reject) => {
    const nonce = generateNonce();
    const encryptedNonce = aesEncrypt(
      JSON.stringify({ nonce }),
      passphrase,
    );

    fetch(`${API_URL}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: encryptedNonce }),
    })
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
              SESSION_ID = decrypted.session_id;
              PASSPHRASE = passphrase;
              initServerStream();
              resolve(decrypted.session_id);
            } else {
              reject("Invalid user/passphrase");
            }
          });
        } else {
          response.text().then((e) => {
            reject(e);
          });
        }
      })
      .catch(() => {
        reject("Request failed");
      });
  });
};

const checkAdmin = (sessionId, passphrase) => {
  return fetch(`${API_URL}/admin/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  })
    .then((r) => {
      if (!r.ok) return { is_admin: false };
      return r.json().then((e) => {
        try {
          return JSON.parse(aesDecrypt(e.data, passphrase));
        } catch {
          return { is_admin: false };
        }
      });
    })
    .catch(() => ({ is_admin: false }));
};

const adminListUsers = (sessionId, passphrase) => {
  return fetch(`${API_URL}/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  }).then((r) => {
    if (!r.ok) return r.text().then((t) => Promise.reject(t));
    return r.json().then((e) => JSON.parse(aesDecrypt(e.data, passphrase)));
  });
};

const adminAddUser = (sessionId, passphrase, newUser, newPassphrase) => {
  const payload = aesEncrypt(
    JSON.stringify({ new_user: newUser, new_passphrase: newPassphrase }),
    passphrase,
  );
  return fetch(`${API_URL}/admin/add_user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, payload }),
  }).then((r) => {
    if (!r.ok) return r.text().then((t) => Promise.reject(t));
    return r.json().then((e) => JSON.parse(aesDecrypt(e.data, passphrase)));
  });
};

const adminRemoveUser = (sessionId, passphrase, targetUser) => {
  const payload = aesEncrypt(
    JSON.stringify({ target_user: targetUser }),
    passphrase,
  );
  return fetch(`${API_URL}/admin/remove_user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, payload }),
  }).then((r) => {
    if (!r.ok) return r.text().then((t) => Promise.reject(t));
    return r.json().then((e) => JSON.parse(aesDecrypt(e.data, passphrase)));
  });
};

const adminSetUserGroups = (sessionId, passphrase, targetUser, groups) => {
  const payload = aesEncrypt(
    JSON.stringify({ target_user: targetUser, groups }),
    passphrase,
  );
  return fetch(`${API_URL}/admin/set_user_groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, payload }),
  }).then((r) => {
    if (!r.ok) return r.text().then((t) => Promise.reject(t));
    return r.json().then((e) => JSON.parse(aesDecrypt(e.data, passphrase)));
  });
};

const adminDeleteChannel = (sessionId, passphrase, channel) => {
  const payload = aesEncrypt(
    JSON.stringify({ channel }),
    passphrase,
  );
  return fetch(`${API_URL}/admin/delete_channel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, payload }),
  }).then((r) => {
    if (!r.ok) return r.text().then((t) => Promise.reject(t));
    return r.json().then((e) => JSON.parse(aesDecrypt(e.data, passphrase)));
  });
};

const adminGetChannelPermissions = (sessionId, passphrase) => {
  return fetch(`${API_URL}/admin/get_channel_permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  }).then((r) => {
    if (!r.ok) return r.text().then((t) => Promise.reject(t));
    return r.json().then((e) => JSON.parse(aesDecrypt(e.data, passphrase)));
  });
};

const adminSetChannelPermissions = (
  sessionId,
  passphrase,
  channel,
  readGroups,
  writeGroups,
) => {
  const payload = aesEncrypt(
    JSON.stringify({
      channel,
      read_groups: readGroups,
      write_groups: writeGroups,
    }),
    passphrase,
  );
  return fetch(`${API_URL}/admin/set_channel_permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, payload }),
  }).then((r) => {
    if (!r.ok) return r.text().then((t) => Promise.reject(t));
    return r.json().then((e) => JSON.parse(aesDecrypt(e.data, passphrase)));
  });
};

export {
  subscribe,
  listenChannels,
  listenHeartbeat,
  validateUser,
  checkAdmin,
  adminListUsers,
  adminAddUser,
  adminRemoveUser,
  adminSetUserGroups,
  adminDeleteChannel,
  adminGetChannelPermissions,
  adminSetChannelPermissions,
};
