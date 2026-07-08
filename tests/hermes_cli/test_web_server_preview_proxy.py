from hermes_cli import web_server
from hermes_cli.dashboard_auth.middleware import _path_is_public


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


def test_preview_routes_bypass_dashboard_cookie_gate():
    assert _path_is_public('/api/preview/open/ticket/path/index.html') is True
    assert _path_is_public('/api/preview/file/signed/index.html') is True
    assert _path_is_public('/api/preview/proxy/signed/index.html') is True


def test_preview_file_resolve_creates_signed_file_url(tmp_path):
    html = tmp_path / 'index.html'
    html.write_text('<h1>OK</h1>', encoding='utf-8')

    result = web_server._preview_file_resolve(str(html))

    assert result['kind'] == 'file'
    assert result['label'] == 'index.html'
    assert result['url'].startswith('/api/preview/file/')
    assert result['url'].endswith('/index.html')


def test_preview_signed_file_path_stays_under_root(tmp_path):
    html = tmp_path / 'index.html'
    html.write_text('<h1>OK</h1>', encoding='utf-8')
    result = web_server._preview_file_resolve(str(html))
    preview_id = result['url'].split('/')[4]
    payload = web_server._preview_read_payload(preview_id, 'file')

    try:
        web_server._preview_path_under(web_server.Path(payload['root']), '../secret.txt')
    except Exception as exc:
        assert getattr(exc, 'status_code', None) == 400
    else:
        raise AssertionError('preview path traversal should be rejected')


def test_preview_proxy_fetch_closed_server_returns_502():
    try:
        web_server._preview_proxy_fetch('http://127.0.0.1:9/preview.html')
    except Exception as exc:
        assert getattr(exc, 'status_code', None) == 502
    else:
        raise AssertionError('closed preview server should return a typed 502')
