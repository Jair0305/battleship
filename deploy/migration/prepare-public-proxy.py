#!/usr/bin/env python3
"""Prepare/validate Battleship's Caddy leaf. Never install a public leaf or reload."""
from datetime import datetime, timezone
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import urllib.request

ROOT = Path('/opt/battleship')
SHARED = Path('/opt/pixel-office-media/data/caddy-config')
BASE = Path('/opt/pixel-office-media/rendered/Caddyfile')
TEMPLATE = Path('/opt/pixel-office-media/templates/Caddyfile')
RENDERER = Path('/opt/pixel-office-media/render.sh')
DOMAIN = 'battleship.nightly.mx'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def command(*args):
    return subprocess.check_output(args, stderr=subprocess.PIPE, timeout=45)


def active_config():
    with urllib.request.urlopen('http://127.0.0.1:2029/config/', timeout=5) as response:
        return json.load(response)


def adapt(container_path):
    return json.loads(command('docker', 'exec', 'pom-caddy', 'caddy', 'adapt',
                              '--adapter', 'caddyfile', '--config', container_path))


def require_persistent_import(data):
    lines = data.decode().splitlines(keepends=True)
    imports = [index for index, line in enumerate(lines)
               if line.split('#', 1)[0].strip() == 'import /config/nightly-sites/*.caddy']
    assert len(imports) == 1, 'Persistent public import missing or duplicated'
    # Caddy block braces are standalone tokens. Preserve quoted tokens and
    # placeholders such as {$ENV}/{host}; neither changes block depth.
    prefix = ''.join(lines[:imports[0]])
    # This guard intentionally accepts a restricted template syntax. Heredocs
    # can contain fake braces/imports; require separate review rather than guess.
    assert '<<' not in prefix, 'Heredocs before the persistent import require separate template review'
    depth, token, quote, comment, escaped = 0, '', None, False, False
    for char in prefix:
        if comment:
            if char == '\n':
                comment = False
            else:
                continue
        if quote:
            token += char
            if escaped:
                escaped = False
            elif char == '\\' and quote == '"':
                escaped = True
            elif char == quote:
                quote = None
        elif char in ('"', '`'):
            token += char
            quote = char
        elif char == '#':
            comment = True
        elif char.isspace():
            if token == '{':
                depth += 1
            elif token == '}':
                depth -= 1
                assert depth >= 0, 'Unbalanced Caddyfile before persistent import'
            token = ''
        else:
            token += char
    assert quote is None and depth == 0, 'Persistent public import must be active at top level'


def candidate_caddyfile(data, staged_leaf):
    require_persistent_import(data)
    # Exercise the installed import's actual location, including its Caddy scope.
    # Appending a separate import could hide a missing or ineffective foundation.
    pattern = rb'(?m)^([ \t]*)import /config/nightly-sites/\*\.caddy([ \t]*(?:#[^\r\n]*)?)(\r?)$'
    result, count = re.subn(pattern, lambda match: match[0] + b'\n' + match[1]
                           + b'import ' + staged_leaf.encode() + match[3], data)
    assert count == 1, 'Could not substitute the persistent import for the staged validation'
    return result


def require_private_path(path, directory=False):
    info = path.lstat()
    expected_type = stat.S_ISDIR if directory else stat.S_ISREG
    assert expected_type(info.st_mode), 'Private path is a link or has an unexpected type'
    assert info.st_uid == info.st_gid == 0, 'Private path must belong to root:root'
    assert stat.S_IMODE(info.st_mode) == (0o700 if directory else 0o600), 'Unsafe private path permissions'
    assert directory or info.st_nlink == 1, 'Private file has additional hard links'


def private_directory(path):
    # Only call for project-owned directories; never chmod shared parent paths.
    if not path.exists() and not path.is_symlink():
        path.mkdir(mode=0o700)
    require_private_path(path, directory=True)


def require_battleship_delta(before, candidate):
    """Remove the exact owned additions, then compare the ENTIRE ordered config."""
    assert DOMAIN not in canonical(before).decode(), 'Battleship already occurs in baseline'
    remaining = deepcopy(candidate)
    servers = remaining['apps']['http']['servers']
    original_servers = before['apps']['http']['servers']
    assert servers.keys() == original_servers.keys(), 'Listener/server set changed'
    route = {'handle': [{'handler': 'subroute', 'routes': [
        {'handle': [{'handler': 'reverse_proxy', 'upstreams': [{'dial': '127.0.0.1:3006'}]}]}
    ]}], 'match': [{'host': [DOMAIN]}], 'terminal': True}
    owned = [(name, index) for name, server in servers.items()
             for index, value in enumerate(server.get('routes', [])) if value == route]
    assert len(owned) == 1, 'Expected exactly one unmodified Battleship route'
    name, index = owned[0]
    server = servers[name]
    original = original_servers[name]
    del server['routes'][index]

    # Caddy records an unlogged new host in this server's skip_hosts.
    if DOMAIN in server.get('logs', {}).get('skip_hosts', []):
        hosts = server['logs']['skip_hosts']
        assert hosts.count(DOMAIN) == 1
        hosts.remove(DOMAIN)
        if not hosts and 'skip_hosts' not in original.get('logs', {}):
            del server['logs']['skip_hosts']
        if not server['logs'] and 'logs' not in original:
            del server['logs']

    tls = remaining['apps']['tls']
    certificates = tls['certificates']
    files = certificates['load_files']
    entries = [entry for entry in files
               if entry.get('certificate') == '/config/battleship-tls/fullchain.pem']
    assert len(entries) == 1, 'Expected exactly one Battleship certificate loader'
    entry = entries[0]
    tags = entry.get('tags', [])
    assert len(tags) == 1 and re.fullmatch(r'cert[0-9]+', tags[0]), 'Unexpected certificate tag'
    assert json.dumps(tags[0]) not in canonical(before).decode(), 'Bootstrap certificate tag overlaps baseline'
    assert entry == {'certificate': '/config/battleship-tls/fullchain.pem',
                     'key': '/config/battleship-tls/privkey.pem', 'tags': tags}, 'Certificate loader changed'
    files.remove(entry)
    original_tls = before['apps'].get('tls', {})
    if not files and 'load_files' not in original_tls.get('certificates', {}):
        del certificates['load_files']
    if not certificates and 'certificates' not in original_tls:
        del tls['certificates']
    if not tls and 'tls' not in before['apps']:
        del remaining['apps']['tls']

    policy = {'certificate_selection': {'any_tag': tags}, 'match': {'sni': [DOMAIN]}}
    policies = server['tls_connection_policies']
    assert policies.count(policy) == 1, 'Bootstrap policy must select only the owned certificate and SNI'
    policies.remove(policy)
    if 'tls_connection_policies' not in original:
        assert policies == [{}], 'Unexpected implicit TLS policy'
        del server['tls_connection_policies']
    assert canonical(remaining) == canonical(before), 'Changes extend beyond the exact Battleship delta'


def leaf_hashes():
    return {p.name: sha(p.read_bytes()) for p in sorted((SHARED / 'nightly-sites').glob('*.caddy'))}


def neighbors():
    result = {}
    for domain in ['rtc.pixel-office.app', 'rtc.nightlysoftware.com',
                   'turn.pixel-office.app', 'turn.nightlysoftware.com']:
        result[domain] = int(command('curl', '--silent', '--show-error', '--noproxy', '*',
            '--connect-timeout', '3', '--max-time', '10', '--resolve', domain + ':443:10.0.0.175',
            '-o', '/dev/null', '-w', '%{http_code}', 'https://' + domain + '/'))
    return result


def protected_containers():
    ids = command('docker', 'ps', '-q').decode().split()
    values = json.loads(command('docker', 'inspect', *ids)) if ids else []
    return {x['Name']: {key: x[key] for key in ['Id', 'Image', 'RestartCount']} |
            {'started_at': x['State']['StartedAt']} for x in values
            if not x['Name'].startswith(('/battleship', '/buildx_buildkit_battleship'))}


def prepare():
    import fcntl
    assert os.geteuid() == 0, 'Run as root to protect TLS keys and hold the shared lock'
    os.umask(0o077)
    with Path('/run/lock/nightly-public-proxy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        utc = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        private_directory(ROOT / 'proxy-packets')
        output = ROOT / 'proxy-packets' / utc
        output.mkdir(mode=0o700, exist_ok=False)
        before_files = {str(p): sha(p.read_bytes()) for p in [BASE, TEMPLATE, RENDERER]}
        for path in [BASE, TEMPLATE]:
            require_persistent_import(path.read_bytes())
        assert command('docker', 'exec', 'pom-caddy', 'cat', '/etc/caddy/Caddyfile') == BASE.read_bytes(), 'Mounted Caddyfile differs'
        before_leaves = leaf_hashes()
        assert 'battleship.caddy' not in before_leaves, 'A public Battleship leaf already exists'
        before_active = active_config()
        before_disk = adapt('/etc/caddy/Caddyfile')
        assert canonical(before_active) == canonical(before_disk), 'Disk/runtime drift; coordinate before proceeding'
        before_neighbors = neighbors()
        assert list(before_neighbors.values()) == [200, 200, 404, 404], 'Neighbor baseline requires investigation'
        before_containers = protected_containers()
        assert DOMAIN not in canonical(before_disk).decode(), 'Battleship already occurs in baseline'

        # Namespaced staging is outside the active import glob. No POM files change.
        assert SHARED.resolve() == SHARED, 'Shared config ancestry contains a link'
        private_directory(SHARED / 'battleship-candidates')
        stage = SHARED / 'battleship-candidates' / utc
        stage.mkdir(mode=0o700, exist_ok=False)
        tls = SHARED / 'battleship-tls'
        private_directory(tls)
        source_tls = ROOT / 'private/tls/etc/letsencrypt/live' / DOMAIN
        for name in ['fullchain.pem', 'privkey.pem']:
            dest = tls / name
            data = (source_tls / name).read_bytes()
            if dest.exists() or dest.is_symlink():
                require_private_path(dest)
                assert dest.read_bytes() == data, 'Existing Battleship TLS material differs'
            else:
                with dest.open('xb') as file:
                    file.write(data)
                require_private_path(dest)
        leaf = (ROOT / 'battleship.bootstrap.caddy').read_bytes()
        (output / 'battleship.caddy').write_bytes(leaf)
        (stage / 'battleship.caddy').write_bytes(leaf)
        container_stage = '/config/battleship-candidates/' + utc
        (stage / 'Caddyfile').write_bytes(candidate_caddyfile(
            BASE.read_bytes(), container_stage + '/battleship.caddy'))
        candidate = adapt(container_stage + '/Caddyfile')
        validation = command('docker', 'exec', 'pom-caddy', 'caddy', 'validate',
                             '--adapter', 'caddyfile', '--config', container_stage + '/Caddyfile')
        (output / 'validate.log').write_bytes(validation)
        require_battleship_delta(before_disk, candidate)
        (output / 'candidate.private.json').write_bytes(canonical(candidate))
        assert before_files == {str(p): sha(p.read_bytes()) for p in [BASE, TEMPLATE, RENDERER]}
        assert before_leaves == leaf_hashes(), 'Public leaf directory changed during preparation'
        assert canonical(before_active) == canonical(active_config()), 'Runtime changed during preparation'
        assert before_containers == protected_containers(), 'A protected container changed'
        assert before_neighbors == neighbors(), 'Neighbor behavior changed'
        receipt = {'status': 'prepared-and-validated-no-install-no-load', 'utc': utc,
            'domain': DOMAIN, 'upstream': '127.0.0.1:3006',
            'public_leaf_sha256': sha(leaf), 'candidate_json_sha256': sha(canonical(candidate)),
            'baseline_json_sha256': sha(canonical(before_active)), 'baseline_files': before_files,
            'baseline_leaves': before_leaves, 'neighbor_probes': before_neighbors,
            'neighbor_routes_unchanged': True, 'protected_containers_unchanged': len(before_containers),
            'full_configuration_delta_verified': True, 'persistent_import_verified': True,
            'tls_root_only_verified': True, 'preparer_sha256': sha(Path(__file__).read_bytes()),
            'packet_directory': str(output), 'staging_directory': str(stage),
            'runtime_reload_performed': False, 'dns_changed': False}
        (output / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    prepare()
