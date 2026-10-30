import time
import uuid

import jwt
import pytest

from app.core import currency
from app.core.auth import decode_token
from app.core.config import Settings
from app.core.errors import Unauthorized
from app.orgs.service import hash_token

SECRET = "unit-test-secret-long-enough-for-hs256-xxxxxxxx"


def _settings(**kw) -> Settings:
    return Settings(supabase_jwt_secret=SECRET, supabase_url="", **kw)


def _tok(**claims) -> str:
    base = {"sub": str(uuid.uuid4()), "aud": "authenticated", "exp": int(time.time()) + 60}
    return jwt.encode({**base, **claims}, SECRET, algorithm="HS256")


def test_decode_valid():
    assert decode_token(_tok(email="a@b.c"), _settings())["email"] == "a@b.c"


def test_wrong_audience_rejected():
    with pytest.raises(Unauthorized):
        decode_token(_tok(aud="someone-else"), _settings())


def test_issuer_checked_when_supabase_url_set():
    s = Settings(supabase_jwt_secret=SECRET, supabase_url="https://abc.supabase.co")
    good = _tok(iss="https://abc.supabase.co/auth/v1")
    assert decode_token(good, s)
    with pytest.raises(Unauthorized):
        decode_token(_tok(iss="https://evil.example/auth/v1"), s)


def test_none_algorithm_rejected():
    unsigned = jwt.encode(
        {"sub": str(uuid.uuid4()), "aud": "authenticated"}, None, algorithm="none"
    )
    with pytest.raises(Unauthorized):
        decode_token(unsigned, _settings())


def test_hs256_refused_without_secret():
    with pytest.raises(Unauthorized):
        decode_token(_tok(), Settings(supabase_jwt_secret="", supabase_url=""))


def test_missing_exp_rejected():
    t = jwt.encode({"sub": str(uuid.uuid4()), "aud": "authenticated"}, SECRET, algorithm="HS256")
    with pytest.raises(Unauthorized):
        decode_token(t, _settings())


@pytest.mark.parametrize("code,units", [("OMR", 3), ("usd", 2), ("JPY", 0), ("KWD", 3)])
def test_minor_units(code, units):
    assert currency.minor_units(code) == units


def test_unknown_currency():
    assert not currency.is_supported("XYZ")


def test_token_hash_is_sha256_hex():
    h = hash_token("abc")
    assert len(h) == 64 and h == hash_token("abc") and h != hash_token("abd")
