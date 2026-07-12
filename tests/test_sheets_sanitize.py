"""Regression: Google Sheets с value_input_option="USER_ENTERED" сам распознаёт строки вида
"2026-07-12" и "09:00" как дату/время и хранит числом (серийная дата / доля суток) — при
чтении обратно приходит число вместо исходной строки. Found during QA-прогона Производства,
2026-07-12."""

from core.sheets import _sanitize_for_sheets


def test_iso_date_gets_escaped_as_text():
    assert _sanitize_for_sheets("2026-07-12") == "'2026-07-12"


def test_time_gets_escaped_as_text():
    assert _sanitize_for_sheets("09:00") == "'09:00"
    assert _sanitize_for_sheets("9:00") == "'9:00"


def test_formula_trigger_chars_still_escaped():
    assert _sanitize_for_sheets("=SUM(A1)") == "'=SUM(A1)"


def test_ordinary_strings_and_numbers_untouched():
    assert _sanitize_for_sheets("Масло кокосовое") == "Масло кокосовое"
    assert _sanitize_for_sheets(0.5) == 0.5
    assert _sanitize_for_sheets("") == ""


def test_string_that_merely_contains_digits_and_colon_but_not_time_shaped_untouched():
    assert _sanitize_for_sheets("12:345") == "12:345"
    assert _sanitize_for_sheets("артикул 09:00 партия") == "артикул 09:00 партия"
