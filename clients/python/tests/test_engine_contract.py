"""The adapter against what this repository's engine writes and accepts.

The NDJSON under docs/examples is engine output, and `bun run check:examples`
fails when it no longer matches the analyzers, so parsing it here checks the
adapter against the engine rather than against a dict written for this test.

The flag tests run the CLI built from this tree. COMPATIBILITY.md names a flag
rename as the way this adapter breaks, and the adapter's own tests replace
the CLI with a fake that accepts any flag.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from refract import Refract, _parse_event  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
EXAMPLES = REPO / "docs" / "examples"
CAPTURED = sorted(EXAMPLES.glob("*.ndjson"))
CLI = Path(
    os.environ.get("REFRACT_CLI", REPO / "packages" / "cli" / "dist" / "src" / "cli.js")
)


def test_has_captured_engine_output():
    assert CAPTURED, f"no engine output under {EXAMPLES}"


@pytest.mark.parametrize("path", CAPTURED, ids=lambda p: p.name)
def test_parses_engine_output_keeping_event_and_analyzer_identity(path):
    lines = [line for line in path.read_text().splitlines() if line.strip()]
    assert lines
    for line in lines:
        raw = json.loads(line)
        event = _parse_event(raw)
        assert event.eventId == raw.get("eventId")
        assert event.schemaVersion == raw.get("schemaVersion")
        assert event.eventType == raw["eventType"]
        assert event.fromRevisionId == raw["fromRevisionId"]
        assert event.toRevisionId == raw["toRevisionId"]
        assert event.section == raw["section"]
        assert event.before == raw["before"]
        assert event.after == raw["after"]
        assert event.layer == raw["layer"]
        assert event.timestamp == raw["timestamp"]
        assert len(event.deterministicFacts) == len(raw["deterministicFacts"])
        for fact, raw_fact in zip(event.deterministicFacts, raw["deterministicFacts"]):
            assert fact.fact == raw_fact["fact"]
            assert fact.detail == raw_fact.get("detail")
            provenance = raw_fact.get("provenance")
            if provenance:
                assert fact.provenance.analyzer == provenance["analyzer"]
                assert fact.provenance.version == provenance["version"]
                assert fact.provenance.inputHashes == provenance["inputHashes"]
            else:
                assert fact.provenance is None


def _cli_help(command: str) -> str:
    if not CLI.exists():
        if "REFRACT_CLI" in os.environ:
            pytest.fail(f"REFRACT_CLI={CLI} does not exist")
        pytest.skip(f"no built CLI at {CLI}; run `bun run build` at the repository root")
    return subprocess.run(
        ["node", str(CLI), command, "--help"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout


def _flags_passed(monkeypatch, call) -> list[str]:
    passed: list[list[str]] = []

    def record(self, args):
        passed.append(args)
        return ""

    monkeypatch.setattr(Refract, "_run", record)
    call(Refract(binary=sys.executable))
    assert len(passed) == 1
    return [arg for arg in passed[0] if arg.startswith("--")]


def test_analyze_passes_only_flags_the_built_cli_has(monkeypatch):
    flags = _flags_passed(
        monkeypatch,
        lambda r: r.analyze(
            "Earth",
            depth="detailed",
            api="https://wiki.example/w/api.php",
            since="2024-01-01T00:00:00Z",
        ),
    )
    assert flags == ["--depth", "--json", "--api", "--since"]
    help_text = _cli_help("analyze")
    for flag in flags:
        assert f"{flag} " in help_text or f"{flag}\n" in help_text, flag


def test_export_passes_only_flags_the_built_cli_has(monkeypatch):
    flags = _flags_passed(
        monkeypatch,
        lambda r: r.export(
            "Earth",
            format="csv",
            flatten=True,
            api="https://wiki.example/w/api.php",
            since="2024-01-01T00:00:00Z",
        ),
    )
    assert flags == ["--format", "--flatten", "--api", "--since"]
    help_text = _cli_help("export")
    for flag in flags:
        assert f"{flag} " in help_text or f"{flag}\n" in help_text, flag
