import unittest

from guard import DEFAULT_TERMINATE, build_prompt, build_transcript, parse_category_list, parse_verdict, should_terminate


class GuardTests(unittest.TestCase):
    def test_reads_safe_and_unsafe(self):
        self.assertEqual(parse_verdict("safe"), {"safe": True, "categories": []})
        self.assertEqual(parse_verdict("unsafe\nS1"), {"safe": False, "categories": ["S1"]})
        self.assertEqual(parse_verdict("unsafe\nS2,S9"), {"safe": False, "categories": ["S2", "S9"]})

    def test_garbled_answers_never_close_a_room(self):
        for raw in ["", None, "I cannot help", "unsafe", "unsafe\nS99"]:
            self.assertTrue(parse_verdict(raw)["safe"], raw)

    def test_category_lists(self):
        self.assertEqual(parse_category_list("S1, s4 ,S99,S13"), ["S1", "S4", "S13"])
        self.assertEqual(parse_category_list(None), [])

    def test_only_severe_categories_end_a_room(self):
        self.assertTrue(should_terminate(["S4"], DEFAULT_TERMINATE))
        self.assertFalse(should_terminate(["S11"], DEFAULT_TERMINATE))  # self-harm is not punished
        self.assertFalse(should_terminate([], DEFAULT_TERMINATE))

    def test_transcript_keeps_the_checked_message_last(self):
        ctx = [{"sender": "a", "text": "first"}, {"sender": "b", "text": "second"}]
        self.assertEqual(build_transcript(ctx, {"sender": "c", "text": "third"}), "a: first\nb: second\nc: third")
        long = [{"sender": "x", "text": "y" * 500} for _ in range(10)]
        out = build_transcript(long, {"sender": "me", "text": "the real message"}, 1200)
        self.assertLessEqual(len(out), 1200)
        self.assertTrue(out.endswith("me: the real message"))

    def test_prompt_follows_llama_guard_format(self):
        p = build_prompt("sam: hello")
        self.assertIn("User: sam: hello", p)
        self.assertIn("S9: Indiscriminate Weapons.", p)
        self.assertTrue(p.endswith("<|start_header_id|>assistant<|end_header_id|>\n\n"))
        self.assertNotIn("<|begin_of_text|>", p)  # llama.cpp adds it


if __name__ == "__main__":
    unittest.main()
