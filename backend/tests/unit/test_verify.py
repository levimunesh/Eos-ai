from app.assistant.verify import numbers_in, verify

RESULT = {
    "kpis": [
        {
            "key": "net_sales",
            "value": "23343.489",
            "change_pct": "0.2692",
            "previous_value": "18392.741",
            "change_abs": "4950.748",
        },
        {"key": "transactions", "value": 2533},
        {"key": "gross_margin", "value": "0.3631"},
    ]
}


def test_exact_and_formatted_figures_verify():
    ok, bad = verify(
        "March net sales were 23,343.489 OMR [1], up 26.92% [1] (+4,950.748 OMR) on "
        "February's 18,392.741 [1], across 2,533 transactions [1]. Margin 36.31% [1].",
        [RESULT],
    )
    assert ok, bad


def test_reasonable_rounding_verifies():
    ok, bad = verify("About 23,343.49 OMR, up 27% with a 36.3% margin.", [RESULT])
    assert ok, bad


def test_fabrications_are_caught():
    ok, bad = verify("Net sales were 25,000.000 OMR, up 31%.", [RESULT])
    assert not ok and bad == ["25,000.000", "31%"]


def test_dates_codes_years_and_small_counts_are_ignored():
    text = (
        "From 2025-03-01 to 31/03/2025 (1 March 2025 - March 31, 2025), branch EOS-02 and "
        "SKU-0012 led; the top 5 products [2] in 2025."
    )
    assert numbers_in(text) == []


def test_negative_change_matches_absolute_value():
    ok, _ = verify("Down 4,950.748 OMR.", [RESULT])
    assert ok
