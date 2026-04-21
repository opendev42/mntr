# Develop mntr

## When to use

Use this skill when working on the mntr project itself — modifying the server, frontend, publisher library, encryption, or any core infrastructure code.

## Instructions

You are developing **mntr**, a real-time encrypted data visualization dashboard. Read `CLAUDE.md` at the project root for the full tech stack, project structure, and setup instructions.

### Architecture

```
Browser (React) <--SSE/encrypted--> Flask Server <--REST/encrypted--> Publishers
```

- **Server** (`mntr/server/server.py`): `MntrServer` class — Flask app, session management, encryption, admin endpoints, channel permissions
- **State** (`mntr/server/state.py`): `MntrState` class — in-memory channel storage, pub/sub with threading conditions, optional JSON persistence, TTL reaper
- **Publisher client** (`mntr/publisher/client.py`): `PublisherClient` — authenticates, encrypts payloads, POSTs to server
- **Publisher data** (`mntr/publisher/data/`): `MonitorData` base class and implementations (plaintext, html, table, chartjs, image, multi)
- **Frontend** (`react_src/src/`): React 18 + Redux Toolkit + MUI 6. Connection via SSE (`util/connection.js`), browser-side AES decryption (`util/encryption.js`)

### Key source files

| File | Purpose |
|------|---------|
| `mntr/server/server.py` | MntrServer: routes, auth, encryption, groups, channel permissions, admin API |
| `mntr/server/state.py` | MntrState: channel data, pub/sub, persistence, ChannelData NamedTuple |
| `mntr/server/__main__.py` | CLI entry point, parses server.yaml |
| `mntr/publisher/client.py` | PublisherClient: auth + encrypted publish |
| `mntr/publisher/data/__init__.py` | MonitorData base, Alert NamedTuple |
| `mntr/publisher/data/impl/` | Data type implementations |
| `mntr/publisher/interval_publisher.py` | IntervalPublisher base, AbstractRunner, ProcessRunner |
| `mntr/publisher/pipe.py` | Pipe publisher CLI |
| `mntr/util/encryption.py` | AES-256-GCM encrypt/decrypt (PBKDF2 key derivation) |
| `react_src/src/util/connection.js` | SSE streams, REST API calls, all admin functions |
| `react_src/src/util/encryption.js` | Browser-side AES encryption (CryptoJS) |
| `react_src/src/components/Panel.js` | Panel component with channel selector |
| `react_src/src/components/appbar/` | AppBar, SideMenu, AdminDialog, ChannelDialog, ServerStatus, Windows |
| `react_src/src/state/` | Redux slices: panelSlice, credentialsSlice, themeSlice, mobileSlice |

### Groups and permissions system

- **User groups** (`_groups` in server.yaml): Users belong to groups. Every user has an implicit personal group matching their username. Admins bypass all group checks.
- **Channel permissions** (admin-managed, stored in `channel_permissions.yaml`):
  - `read_groups`: who can see/subscribe to a channel (None = all)
  - `write_groups`: who can publish to a channel (None = all)
- **Publisher groups** (`ChannelData.groups`): fallback read visibility set by publishers at publish time. Admin `read_groups` takes precedence when set.
- **Precedence**: admin channel permissions > publisher-set groups > unrestricted

### Threading model

- `MntrState` uses `threading.Lock` for `_channel_data` mutations and `threading.Condition` for pub/sub notification
- `MntrServer` uses `_lock` for credentials/permissions mutations and `_session_lock` for session management
- Heartbeat and subscribe are long-lived generators running in Flask request threads
- `_filter_channels` and `_check_subscribe_permissions` read state without holding locks (consistent with the existing concurrency model, acceptable because ChannelData is immutable once published)

### Development workflow

1. **Python changes**: Edit, then run `venv.mntr/bin/pytest` to verify
2. **Frontend changes**: Edit in `react_src/src/`, then `cd react_src && npm run build` to compile into `mntr/web/`
3. **Quality checks**: `venv.mntr/bin/ruff check mntr/` (lint), `venv.mntr/bin/mypy mntr/` (types)
4. **Test server**: `PYTHONPATH=. venv.mntr/bin/python -m mntr.server --address 0.0.0.0 --port 5100 --client_passphrases demo/passphrases/server.yaml --debug`
5. **Test publishers**: `PYTHONPATH=demo venv.mntr/bin/python -m mntr.publisher.interval_publisher --config demo/examples/config.yaml --server http://localhost:5100 --name client0 --passphrase demo/passphrases/client0.txt`

### Code conventions

- Python: type hints (Mypy-compatible), NamedTuples for data classes, `logging.getLogger(__name__)`
- React: functional components with hooks, Redux slices, MUI component composition
- Tests: alongside source in `test/` subdirectories, pytest fixtures, direct unit tests of server internals
- All admin endpoints follow the same pattern: authenticate admin, decrypt payload, validate, mutate under `_lock`, save to disk, return encrypted response
- All REST payloads are AES-256-GCM encrypted. The frontend uses `aesEncrypt`/`aesDecrypt` from `util/encryption.js`.

### Adding a new admin endpoint (recipe)

1. Add the method to `MntrServer` with `@handle_exception` decorator
2. Call `self._authenticate_admin(body)` to verify admin
3. Decrypt payload with `aes_decrypt(body.get("payload", ""), session.passphrase)`
4. Validate inputs, mutate state under `self._lock`, persist if needed
5. Return `json.dumps({"data": aes_encrypt(response, session.passphrase)})`
6. Register the route in `get_app()`
7. Add the frontend API function in `connection.js` following the existing pattern
8. Add tests

### Adding a new frontend component (recipe)

1. Create component in `react_src/src/components/`
2. Use `useSelector` for Redux state, `useDispatch` for actions
3. API calls go through functions in `util/connection.js`
4. All server communication is encrypted — use `aesEncrypt`/`aesDecrypt`
5. Run `npm run build` in `react_src/` to compile
