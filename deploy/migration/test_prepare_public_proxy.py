"""Regression cases for shared-ingress isolation; no Docker, SSH, or reloads."""
from copy import deepcopy
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('proxy', Path(__file__).with_name('prepare-public-proxy.py'))
proxy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proxy)


class ConfigIsolation(unittest.TestCase):
    def setUp(self):
        self.before = {
            'admin': {'listen': '127.0.0.1:2029'},
            'logging': {'logs': {'default': {'level': 'INFO'}}},
            'apps': {'http': {'servers': {'srv0': {
                'listen': ['10.0.0.175:443'],
                'logs': {'skip_hosts': ['turn.pixel-office.app']},
                'routes': [
                    {'match': [{'host': ['rtc.pixel-office.app']}], 'handle': [{'handler': 'reverse_proxy'}]},
                    {'handle': [{'handler': 'static_response', 'status_code': 404}]}
                ]
            }}}}
        }
        self.candidate = deepcopy(self.before)
        self.server = self.candidate['apps']['http']['servers']['srv0']
        self.server['routes'].insert(1, {
            'handle': [{'handler': 'subroute', 'routes': [
                {'handle': [{'handler': 'reverse_proxy', 'upstreams': [{'dial': '127.0.0.1:3006'}]}]}
            ]}], 'match': [{'host': [proxy.DOMAIN]}], 'terminal': True
        })
        self.server['logs']['skip_hosts'].insert(0, proxy.DOMAIN)
        self.server['tls_connection_policies'] = [
            {'certificate_selection': {'any_tag': ['cert0']}, 'match': {'sni': [proxy.DOMAIN]}}, {}
        ]
        self.candidate['apps']['tls'] = {'certificates': {'load_files': [{
            'certificate': '/config/battleship-tls/fullchain.pem',
            'key': '/config/battleship-tls/privkey.pem', 'tags': ['cert0']
        }]}}

    def check_rejected(self):
        with self.assertRaises(AssertionError):
            proxy.require_battleship_delta(self.before, self.candidate)

    def test_exact_addition_accepted_without_mutating_inputs(self):
        baseline, candidate = deepcopy(self.before), deepcopy(self.candidate)
        proxy.require_battleship_delta(self.before, self.candidate)
        self.assertEqual((self.before, self.candidate), (baseline, candidate))

    def test_priority_catchall_rejected(self):
        self.server['routes'].insert(0, {'handle': [{'handler': 'static_response', 'status_code': 503}]})
        self.check_rejected()

    def test_existing_route_reorder_rejected(self):
        self.server['routes'][0], self.server['routes'][2] = self.server['routes'][2], self.server['routes'][0]
        self.check_rejected()

    def test_global_tls_automation_rejected(self):
        self.candidate['apps']['tls']['automation'] = {'policies': [{'subjects': ['rtc.pixel-office.app']}]}
        self.check_rejected()

    def test_global_logging_change_rejected(self):
        self.candidate['logging']['logs']['default']['level'] = 'ERROR'
        self.check_rejected()

    def test_added_admin_listener_rejected(self):
        self.candidate['admin']['listen'] = '0.0.0.0:2029'
        self.check_rejected()

    def test_own_route_widened_to_other_host_rejected(self):
        self.server['routes'][1]['match'][0]['host'].append('rtc.pixel-office.app')
        self.check_rejected()

    def test_own_certificate_policy_widened_rejected(self):
        self.server['tls_connection_policies'][0]['match']['sni'].append('rtc.pixel-office.app')
        self.check_rejected()

    def test_existing_tls_and_policy_preserved(self):
        tls = {'automation': {'policies': [{'subjects': ['rtc.pixel-office.app']}]}}
        policy = {'match': {'sni': ['rtc.pixel-office.app']}, 'protocol_min': 'tls1.3'}
        self.before['apps']['tls'] = deepcopy(tls)
        self.candidate['apps']['tls'].update(tls)
        self.before['apps']['http']['servers']['srv0']['tls_connection_policies'] = [deepcopy(policy)]
        self.server['tls_connection_policies'][1] = deepcopy(policy)
        proxy.require_battleship_delta(self.before, self.candidate)
        self.server['tls_connection_policies'][1]['protocol_min'] = 'tls1.2'
        self.check_rejected()


class PersistentImport(unittest.TestCase):
    def test_import_required_even_for_empty_glob(self):
        for data in [b'', b'# import /config/nightly-sites/*.caddy\n', b'import /some/direct/leaf.caddy\n']:
            with self.subTest(data=data), self.assertRaises(AssertionError):
                proxy.require_persistent_import(data)

    def test_single_import_accepted_duplicates_rejected(self):
        data = b'import /config/nightly-sites/*.caddy # shared ingress\n'
        proxy.require_persistent_import(data)
        with self.assertRaises(AssertionError):
            proxy.require_persistent_import(data + data)

    def test_candidate_uses_persistent_import_location(self):
        data = b'# import /config/nightly-sites/*.caddy\nimport /config/nightly-sites/*.caddy # foundation\n'
        candidate = proxy.candidate_caddyfile(data, '/config/battleship-candidates/test/battleship.caddy')
        self.assertEqual(candidate, data + b'import /config/battleship-candidates/test/battleship.caddy\n')

    def test_unused_snippet_or_site_import_rejected(self):
        for header in [b'(unused)', b'other.example']:
            with self.subTest(header=header), self.assertRaises(AssertionError):
                proxy.require_persistent_import(header + b' {\n import /config/nightly-sites/*.caddy\n}\n')

    def test_template_scope_mismatch_rejected(self):
        rendered = b'import /config/nightly-sites/*.caddy\n'
        template = b'(unused) {\n import /config/nightly-sites/*.caddy\n}\n'
        proxy.require_persistent_import(rendered)
        with self.assertRaises(AssertionError):
            proxy.require_persistent_import(template)

    def test_heredoc_cannot_fake_top_level_import(self):
        template = b'(unused) {\n respond <<BODY\n}\nimport /config/nightly-sites/*.caddy\nBODY\n}\n'
        with self.assertRaises(AssertionError):
            proxy.require_persistent_import(template)

    def test_quotes_comments_and_placeholders_preserve_scope(self):
        valid = b'{\n admin {$ADMIN} # } ignored\n}\nexample.com {\n respond "}"\n header Test `literal { }`\n}\nimport /config/nightly-sites/*.caddy\n'
        proxy.require_persistent_import(valid)
        with self.assertRaises(AssertionError):
            proxy.require_persistent_import(b'example.com {\n respond "}"\nimport /config/nightly-sites/*.caddy\n}\n')
        with self.assertRaises(AssertionError):
            proxy.require_persistent_import(b'example.com {\n respond `multiline\nimport /config/nightly-sites/*.caddy\n`\n}\n')


@unittest.skipUnless(os.name == 'posix' and os.geteuid() == 0, 'Root-owned Linux filesystem checks')
class PrivateTLS(unittest.TestCase):
    def test_reuse_rejects_insecure_directory_and_key(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            directory.chmod(0o700)
            key = directory / 'key.pem'
            key.write_bytes(b'fixture, not a real key')
            key.chmod(0o600)
            proxy.require_private_path(directory, directory=True)
            proxy.require_private_path(key)
            directory.chmod(0o755)
            with self.assertRaises(AssertionError):
                proxy.require_private_path(directory, directory=True)
            directory.chmod(0o700)
            key.chmod(0o644)
            with self.assertRaises(AssertionError):
                proxy.require_private_path(key)

    def test_links_and_nonroot_ownership_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            key = directory / 'key.pem'
            key.write_bytes(b'fixture, not a real key')
            key.chmod(0o600)
            link = directory / 'link.pem'
            link.symlink_to(key)
            with self.assertRaises(AssertionError):
                proxy.require_private_path(link)
            hardlink = directory / 'hardlink.pem'
            os.link(key, hardlink)
            with self.assertRaises(AssertionError):
                proxy.require_private_path(key)
            hardlink.unlink()
            os.chown(key, 65534, 65534)
            with self.assertRaises(AssertionError):
                proxy.require_private_path(key)


if __name__ == '__main__':
    unittest.main()
