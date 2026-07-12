"""Regression: ISSUE-001 — append_row не сбрасывал кэш read_sheet для листа,
который реально читался (несовпадение кэш-ключа при неявном access=False).
Found by /qa on 2026-07-12
Report: .gstack/qa-reports/qa-report-localhost-2026-07-12.md"""

import pandas as pd
import pytest

from core import sheets


class _FakeWorksheet:
    def __init__(self, rows: list[list[str]]):
        self.rows = rows

    def append_row(self, row, value_input_option=None):
        self.rows.append(row)

    def get_all_records(self, **kwargs):
        header, *data = self.rows
        return [dict(zip(header, row)) for row in data]


@pytest.fixture(autouse=True)
def _clear_cache():
    sheets.read_sheet.clear()
    yield
    sheets.read_sheet.clear()


def test_append_row_invalidates_cache_for_subsequent_read(monkeypatch):
    headers = ("id", "value")
    ws = _FakeWorksheet([list(headers), ["1", "a"]])
    monkeypatch.setattr(sheets, "get_worksheet", lambda *a, **k: ws)
    monkeypatch.setattr(sheets, "_with_retry", lambda func, *a, **k: func(*a, **k))

    before = sheets.read_sheet("SomeSheet", headers=headers)
    assert len(before) == 1

    sheets.append_row("SomeSheet", ["2", "b"], headers=headers)

    after = sheets.read_sheet("SomeSheet", headers=headers)
    assert len(after) == 2, "read_sheet вернул закэшированные (устаревшие) данные после append_row"
    assert list(after["id"]) == ["1", "2"]
