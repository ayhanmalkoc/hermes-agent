from hermes_cli import web_server


def test_preview_proxy_accepts_loopback_with_port():
    parsed = web_server._preview_proxy_target('http://localhost:5173/demo')

    assert parsed.hostname == '127.0.0.1'
    assert parsed.port == 5173
    assert parsed.path == '/demo'


def test_preview_proxy_rejects_non_loopback_hosts():
    for url in ['https://example.com/demo', 'http://169.254.169.254/latest', 'http://10.0.0.2:5173/demo']:
        try:
            web_server._preview_proxy_target(url)
        except Exception as exc:
            assert getattr(exc, 'status_code', None) == 400
        else:
            raise AssertionError(f'{url} should be rejected')


def test_preview_proxy_rejects_missing_port():
    try:
        web_server._preview_proxy_target('http://localhost/demo')
    except Exception as exc:
        assert getattr(exc, 'status_code', None) == 400
    else:
        raise AssertionError('loopback URL without port should be rejected')
