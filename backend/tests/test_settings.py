from app.settings import _parse_bool, _parse_csv


def test_parse_bool_handles_common_truthy_values():
    assert _parse_bool("true", False) is True
    assert _parse_bool("1", False) is True
    assert _parse_bool("yes", False) is True
    assert _parse_bool("on", False) is True


def test_parse_bool_returns_default_for_none():
    assert _parse_bool(None, True) is True
    assert _parse_bool(None, False) is False


def test_parse_csv_uses_default_and_trims_values():
    default = ["http://localhost:5173"]
    assert _parse_csv(None, default) == default
    assert _parse_csv(" https://a.com , https://b.com ", default) == [
        "https://a.com",
        "https://b.com",
    ]
