import time

import pytest
import simplejson as json

from mntr.server.server import MntrServer, MntrServerException
from mntr.util.encryption import aes_decrypt, aes_encrypt


@pytest.fixture
def server():
    return MntrServer(
        client_passphrases={
            "alice": "alice-pass",
            "bob": "bob-pass",
        },
        admin_users={"alice"},
        session_ttl=60.0,
    )


class TestIdentifyUser:
    def test_identifies_correct_user(self, server):
        encrypted = aes_encrypt('{"nonce": "abc123"}', "alice-pass")
        user, passphrase = server._identify_user(encrypted)
        assert user == "alice"
        assert passphrase == "alice-pass"

    def test_identifies_second_user(self, server):
        encrypted = aes_encrypt('{"nonce": "xyz"}', "bob-pass")
        user, passphrase = server._identify_user(encrypted)
        assert user == "bob"
        assert passphrase == "bob-pass"

    def test_rejects_unknown_passphrase(self, server):
        encrypted = aes_encrypt('{"nonce": "test"}', "wrong-pass")
        with pytest.raises(MntrServerException, match="Invalid credentials"):
            server._identify_user(encrypted)


class TestSessionManagement:
    def test_create_and_resolve_session(self, server):
        session_id = server._create_session("alice")
        session = server._resolve_session(session_id)
        assert session.user == "alice"
        assert session.passphrase == "alice-pass"

    def test_resolve_invalid_session(self, server):
        with pytest.raises(MntrServerException, match="Invalid session"):
            server._resolve_session("nonexistent")

    def test_session_expiry(self):
        server = MntrServer(
            client_passphrases={"alice": "alice-pass"},
            session_ttl=0.1,
        )
        session_id = server._create_session("alice")
        time.sleep(0.2)
        with pytest.raises(MntrServerException, match="Session expired"):
            server._resolve_session(session_id)


class TestValidate:
    def test_validate_returns_encrypted_session(self, server):
        encrypted_nonce = aes_encrypt(
            json.dumps({"nonce": "test123"}), "alice-pass"
        )
        result = server.validate(encrypted_nonce)
        assert "message" in result

        decrypted = json.loads(aes_decrypt(result["message"], "alice-pass"))
        assert decrypted["subscriber"] == "alice"
        assert "session_id" in decrypted
        assert "nonce" in decrypted

    def test_validate_creates_usable_session(self, server):
        encrypted_nonce = aes_encrypt(
            json.dumps({"nonce": "test"}), "bob-pass"
        )
        result = server.validate(encrypted_nonce)
        decrypted = json.loads(aes_decrypt(result["message"], "bob-pass"))

        session = server._resolve_session(decrypted["session_id"])
        assert session.user == "bob"

    def test_validate_rejects_bad_passphrase(self, server):
        encrypted_nonce = aes_encrypt(
            json.dumps({"nonce": "test"}), "wrong-pass"
        )
        with pytest.raises(MntrServerException, match="Invalid credentials"):
            server.validate(encrypted_nonce)


class TestPublish:
    def test_publish_with_session(self, server):
        session_id = server._create_session("alice")
        session = server._resolve_session(session_id)

        payload = aes_encrypt(
            json.dumps({
                "channel": "test-chan",
                "data": {"display_type": "plaintext", "data": {"text": "hi"}},
                "encoding": "utf8",
            }),
            "alice-pass",
        )
        server.publish(session, payload)

    def test_publish_with_ttl(self, server):
        session_id = server._create_session("alice")
        session = server._resolve_session(session_id)

        payload = aes_encrypt(
            json.dumps({
                "channel": "ttl-chan",
                "data": {"display_type": "plaintext", "data": {"text": "temp"}},
                "encoding": "utf8",
                "ttl": 30.0,
            }),
            "alice-pass",
        )
        server.publish(session, payload)
        cd = server._state._get_channel_data("ttl-chan")
        assert cd is not None
        assert cd.ttl == 30.0
        assert cd.expires_at is not None

    def test_publish_without_ttl_backward_compatible(self, server):
        session_id = server._create_session("alice")
        session = server._resolve_session(session_id)

        payload = aes_encrypt(
            json.dumps({
                "channel": "perm-chan",
                "data": {"display_type": "plaintext", "data": {"text": "permanent"}},
                "encoding": "utf8",
            }),
            "alice-pass",
        )
        server.publish(session, payload)
        cd = server._state._get_channel_data("perm-chan")
        assert cd is not None
        assert cd.ttl is None
        assert cd.expires_at is None

    def test_publish_rejects_bad_decryption(self, server):
        session_id = server._create_session("alice")
        session = server._resolve_session(session_id)

        bad_payload = aes_encrypt("garbage", "wrong-pass")
        with pytest.raises(MntrServerException, match="Invalid decryption"):
            server.publish(session, bad_payload)


class TestAdminDeleteChannel:
    def test_admin_can_delete_channel(self, server):
        session_id = server._create_session("alice")
        session = server._resolve_session(session_id)

        pub_payload = aes_encrypt(
            json.dumps({
                "channel": "del-chan",
                "data": {"display_type": "plaintext", "data": {"text": "bye"}},
                "encoding": "utf8",
            }),
            "alice-pass",
        )
        server.publish(session, pub_payload)
        assert server._state._get_channel_data("del-chan") is not None

        server._state.remove_channel("del-chan")
        assert server._state._get_channel_data("del-chan") is None

    def test_non_admin_cannot_delete_channel(self, server):
        session_id = server._create_session("bob")
        body = {
            "session_id": session_id,
            "payload": aes_encrypt(
                json.dumps({"channel": "test-chan"}), "bob-pass"
            ),
        }
        with pytest.raises(MntrServerException, match="Not an admin"):
            server._authenticate_admin(body)


@pytest.fixture
def grouped_server():
    return MntrServer(
        client_passphrases={
            "alice": "alice-pass",
            "bob": "bob-pass",
            "carol": "carol-pass",
        },
        admin_users={"alice"},
        user_groups={"ops": ["bob"], "dev": ["carol"]},
        session_ttl=60.0,
    )


def _publish_channel(server, user, channel, groups=None):
    session_id = server._create_session(user)
    session = server._resolve_session(session_id)
    payload_dict = {
        "channel": channel,
        "data": {"display_type": "plaintext", "data": {"text": "test"}},
        "encoding": "utf8",
    }
    if groups is not None:
        payload_dict["groups"] = groups
    payload = aes_encrypt(json.dumps(payload_dict), f"{user}-pass")
    server.publish(session, payload)


class TestGroupPermissions:
    def test_get_user_groups_implicit(self, grouped_server):
        groups = grouped_server._get_user_groups("alice")
        assert groups == {"alice"}

    def test_get_user_groups_explicit(self, grouped_server):
        groups = grouped_server._get_user_groups("bob")
        assert groups == {"bob", "ops"}

    def test_get_user_groups_multiple(self, grouped_server):
        groups = grouped_server._get_user_groups("carol")
        assert groups == {"carol", "dev"}

    def test_user_can_access_ungrouped_channel(self, grouped_server):
        _publish_channel(grouped_server, "alice", "open-chan")
        filtered = grouped_server._filter_channels(
            "bob", ["open-chan"]
        )
        assert filtered == ["open-chan"]

    def test_user_can_access_matching_group(self, grouped_server):
        _publish_channel(grouped_server, "alice", "ops-chan", groups=["ops"])
        filtered = grouped_server._filter_channels(
            "bob", ["ops-chan"]
        )
        assert filtered == ["ops-chan"]

    def test_user_cannot_access_other_group(self, grouped_server):
        _publish_channel(grouped_server, "alice", "dev-chan", groups=["dev"])
        filtered = grouped_server._filter_channels(
            "bob", ["dev-chan"]
        )
        assert filtered == []

    def test_admin_bypasses_groups(self, grouped_server):
        _publish_channel(grouped_server, "alice", "restricted", groups=["dev"])
        filtered = grouped_server._filter_channels(
            "alice", ["restricted"]
        )
        assert filtered == ["restricted"]

    def test_implicit_personal_group(self, grouped_server):
        _publish_channel(grouped_server, "alice", "bob-chan", groups=["bob"])
        filtered = grouped_server._filter_channels(
            "bob", ["bob-chan"]
        )
        assert filtered == ["bob-chan"]
        filtered = grouped_server._filter_channels(
            "carol", ["bob-chan"]
        )
        assert filtered == []

    def test_subscribe_permission_denied(self, grouped_server):
        _publish_channel(
            grouped_server, "alice", "secret-chan", groups=["ops"]
        )
        with pytest.raises(MntrServerException, match="Permission denied"):
            grouped_server._check_subscribe_permissions(
                "carol", ["secret-chan"]
            )

    def test_subscribe_permission_granted(self, grouped_server):
        _publish_channel(
            grouped_server, "alice", "ops-chan2", groups=["ops"]
        )
        grouped_server._check_subscribe_permissions("bob", ["ops-chan2"])

    def test_publish_with_groups_stored(self, grouped_server):
        _publish_channel(
            grouped_server, "alice", "tagged-chan", groups=["ops", "dev"]
        )
        cd = grouped_server._state._get_channel_data("tagged-chan")
        assert cd is not None
        assert cd.groups == ["ops", "dev"]

    def test_publish_without_groups_backward_compat(self, grouped_server):
        _publish_channel(grouped_server, "alice", "compat-chan")
        cd = grouped_server._state._get_channel_data("compat-chan")
        assert cd is not None
        assert cd.groups is None
