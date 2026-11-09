"""Run with: python3 -m unittest discover -s tests -v"""

import http.client
import json
import threading
import unittest
from pathlib import Path
from http.server import ThreadingHTTPServer

from server import CSP, GameHandler, ROUTES, WEB_ROOT


class LocalServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), GameHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, path, method="GET", headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        try:
            connection.request(method, path, headers=headers or {})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_assets_available_with_correct_headers(self):
        for route, filename in ROUTES.items():
            with self.subTest(route=route):
                status, headers, body = self.request(route)
                self.assertEqual(status, 200)
                self.assertEqual(body, (WEB_ROOT / filename).read_bytes())
                self.assertEqual(headers["Content-Security-Policy"], CSP)
                self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
                self.assertNotIn("Access-Control-Allow-Origin", headers)
                self.assertEqual(headers["Cache-Control"], "no-store")

    def test_head_and_query_string(self):
        status, headers, body = self.request("/game.js?v=1", "HEAD")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"")
        self.assertEqual(int(headers["Content-Length"]), (WEB_ROOT / "game.js").stat().st_size)

    def test_only_loopback_interface_is_bound(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")

    def test_workspace_and_encoded_traversal_are_inaccessible(self):
        for path in ("/server.py", "/README.md", "/.git/config", "/../server.py",
                     "/%2e%2e/server.py", "/web/", "/words.json/../server.py"):
            with self.subTest(path=path):
                status, _, body = self.request(path)
                self.assertEqual(status, 404)
                self.assertNotIn(b"import argparse", body)

    def test_reject_foreign_host_and_allow_explicit_localhost(self):
        status, _, _ = self.request("/", headers={"Host": "untrusted.example"})
        self.assertEqual(status, 403)
        status, _, _ = self.request("/", headers={"Host": "localhost:{}".format(self.server.server_port)})
        self.assertEqual(status, 200)

    def test_no_server_write_endpoint(self):
        status, _, _ = self.request("/words.json", method="POST")
        self.assertEqual(status, 501)

    def test_duplicate_host_headers_are_rejected(self):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        try:
            connection.putrequest("GET", "/nouns.json", skip_host=True)
            connection.putheader("Host", "127.0.0.1:{}".format(self.server.server_port))
            connection.putheader("Host", "untrusted.example")
            connection.endheaders()
            response = connection.getresponse()
            self.assertEqual(response.status, 403)
            response.read()
        finally:
            connection.close()


class CurriculumTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.words = json.loads((WEB_ROOT / "words.json").read_text(encoding="utf-8"))

    def test_curriculum_matches_rule_and_has_complete_sentence_templates(self):
        seen = set()
        for word in self.words:
            with self.subTest(verb=word["verb"]):
                self.assertNotIn(word["verb"], seen)
                seen.add(word["verb"])
                raw = word["verb"][:-2]
                sound = "ch" if raw.endswith("ch") else raw[-1]
                self.assertEqual(word["sound"], sound)
                expected = "t" if sound in {"t", "k", "f", "s", "ch", "p", "x"} else "d"
                self.assertEqual(word["ending"], expected)
                self.assertTrue(word["past"].endswith(expected + "e"))
                self.assertTrue(word["participle"].endswith(expected))
                self.assertIn(word["level"], ("easy", "tricky"))
                for kind in ("past", "participle"):
                    self.assertEqual(word[kind + "Sentence"].count("{word}"), 1)
                    self.assertTrue(word[kind + "Sentence"].endswith("."))

    def test_known_tricky_forms_are_explicit_not_guessed_from_ik_form(self):
        words = {word["verb"]: word for word in self.words}
        for verb, past, participle in (
            ("leven", "leefde", "geleefd"), ("reizen", "reisde", "gereisd"),
            ("antwoorden", "antwoordde", "geantwoord"), ("wachten", "wachtte", "gewacht"),
            ("verhuizen", "verhuisde", "verhuisd"), ("ontmoeten", "ontmoette", "ontmoet"),
            ("fixen", "fixte", "gefixt"), ("redden", "redde", "gered")
        ):
            with self.subTest(verb=verb):
                self.assertEqual((words[verb]["past"], words[verb]["participle"]), (past, participle))

    def test_each_level_supports_full_rounds_with_both_endings(self):
        for level in ("easy", "tricky"):
            pool = [word for word in self.words if word["level"] == level]
            self.assertGreaterEqual(len(pool), 10)
            self.assertGreaterEqual(sum(word["ending"] == "d" for word in pool), 5)
            self.assertGreaterEqual(sum(word["ending"] == "t" for word in pool), 5)

    def test_browser_assets_do_not_reference_remote_resources(self):
        for filename in ("index.html", "game.js", "style.css", "words.json", "strong-words.json", "nouns.json"):
            text = (WEB_ROOT / filename).read_text(encoding="utf-8")
            self.assertNotRegex(text, r"https?://|@import|https?:\\/\\/")


class StrongVerbTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.words = json.loads((WEB_ROOT / "strong-words.json").read_text(encoding="utf-8"))

    def test_strong_forms_against_checked_reference_pairs(self):
        expected = {
            "lopen": ("liep", "gelopen"), "kijken": ("keek", "gekeken"),
            "slapen": ("sliep", "geslapen"), "eten": ("at", "gegeten"),
            "drinken": ("dronk", "gedronken"), "zwemmen": ("zwom", "gezwommen"),
            "zingen": ("zong", "gezongen"), "lezen": ("las", "gelezen"),
            "geven": ("gaf", "gegeven"), "nemen": ("nam", "genomen"),
            "komen": ("kwam", "gekomen"), "zitten": ("zat", "gezeten"),
            "staan": ("stond", "gestaan"), "vallen": ("viel", "gevallen"),
            "vinden": ("vond", "gevonden"), "schrijven": ("schreef", "geschreven"),
            "blijven": ("bleef", "gebleven"), "rijden": ("reed", "gereden"),
            "vliegen": ("vloog", "gevlogen"), "springen": ("sprong", "gesprongen"),
            "trekken": ("trok", "getrokken"), "spreken": ("sprak", "gesproken"),
            "breken": ("brak", "gebroken"), "kiezen": ("koos", "gekozen"),
            "vergeten": ("vergat", "vergeten"), "beginnen": ("begon", "begonnen"),
            "sluiten": ("sloot", "gesloten"), "snijden": ("sneed", "gesneden"),
            "dragen": ("droeg", "gedragen"), "bijten": ("beet", "gebeten")
        }
        actual = {word["verb"]: (word["past"], word["participle"]) for word in self.words}
        self.assertEqual(actual, expected)
        self.assertEqual(len(actual), len(self.words))

    def test_choices_and_hints_have_one_answer_and_a_changed_sound(self):
        for word in self.words:
            with self.subTest(verb=word["verb"]):
                choices = [word["past"]] + word["distractors"]
                self.assertEqual(len(choices), 3)
                self.assertEqual(len(set(choices)), 3)
                self.assertTrue(all(choice.isalpha() and choice.islower() for choice in choices))
                self.assertNotEqual(word["present"], word["past"])
                self.assertNotEqual(word["presentSound"], word["pastSound"])
                self.assertTrue(word["presentSound"])
                self.assertTrue(word["pastSound"])
                self.assertEqual(word["pastSentence"].count("{word}"), 1)
                self.assertTrue(word["pastSentence"].endswith("."))
                self.assertIn(word["level"], ("easy", "tricky"))

    def test_levels_support_rounds_and_do_not_overlap_weak_verbs(self):
        for level in ("easy", "tricky"):
            self.assertGreaterEqual(sum(word["level"] == level for word in self.words), 10)
        weak = json.loads((WEB_ROOT / "words.json").read_text(encoding="utf-8"))
        self.assertFalse({word["verb"] for word in weak} & {word["verb"] for word in self.words})

    def test_strong_participle_exercises_are_complete_and_unambiguous(self):
        for word in self.words:
            with self.subTest(verb=word["verb"]):
                choices = [word["participle"]] + word["participleDistractors"]
                self.assertEqual(len(choices), 3)
                self.assertEqual(len(set(choices)), 3)
                self.assertTrue(all(choice.isalpha() and choice.islower() for choice in choices))
                self.assertEqual(word["participleSentence"].count("{word}"), 1)
                self.assertTrue(word["participleSentence"].endswith("."))


class ArticleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nouns = json.loads((WEB_ROOT / "nouns.json").read_text(encoding="utf-8"))

    def test_common_nouns_use_the_expected_articles(self):
        de_words = set("tafel stoel deur fiets hond kat boom bloem school straat trein bus jas tas appel "
                       "sleutel keuken kamer tuin winkel markt vraag tijd taal les kinderen huizen boekjes hondjes stoeltjes".split())
        het_words = set("boek huis kind water brood raam bed paard dier ei oor oog hoofd licht spel "
                        "ontbijt antwoord verhaal woord papier gezicht weer werk geld meisje jongetje tafeltje kopje boompje briefje".split())
        expected = {word: "de" for word in de_words}
        expected.update({word: "het" for word in het_words})
        self.assertEqual({word["noun"]: word["article"] for word in self.nouns}, expected)
        self.assertEqual(len(self.nouns), len(expected))

    def test_plural_diminutives_do_not_get_singular_diminutive_rule(self):
        by_noun = {word["noun"]: word for word in self.nouns}
        for noun in ("boekjes", "hondjes", "stoeltjes", "kinderen", "huizen"):
            self.assertEqual((by_noun[noun]["article"], by_noun[noun]["rule"]), ("de", "plural"))
        for noun in ("meisje", "jongetje", "tafeltje", "kopje", "boompje", "briefje"):
            self.assertEqual((by_noun[noun]["article"], by_noun[noun]["rule"]), ("het", "diminutive"))

    def test_every_difficulty_supports_balanced_rounds_and_usable_hints(self):
        for level in ("easy", "tricky"):
            for article in ("de", "het"):
                self.assertGreaterEqual(sum(word["level"] == level and word["article"] == article
                                            for word in self.nouns), 5)
        for word in self.nouns:
            with self.subTest(noun=word["noun"]):
                self.assertIn(word["level"], ("easy", "tricky"))
                self.assertIn(word["rule"], ("learn", "plural", "diminutive"))
                self.assertTrue(word["noun"].isalpha() and word["noun"].islower())
                self.assertGreater(len(word["hint"]), 15)


if __name__ == "__main__":
    unittest.main()
