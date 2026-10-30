"""ISO 4217 currencies the product accepts, with their minor units (decimal places).

Display rounding uses these; storage always keeps 4 decimals.
"""

MINOR_UNITS: dict[str, int] = {
    # GCC and wider Middle East
    "OMR": 3,
    "AED": 2,
    "SAR": 2,
    "QAR": 2,
    "KWD": 3,
    "BHD": 3,
    "JOD": 3,
    "EGP": 2,
    "IQD": 3,
    "LBP": 2,
    "TRY": 2,
    "ILS": 2,
    "IRR": 2,
    # Africa
    "KES": 2,
    "UGX": 0,
    "TZS": 2,
    "RWF": 0,
    "ETB": 2,
    "NGN": 2,
    "GHS": 2,
    "ZAR": 2,
    "MAD": 2,
    "TND": 3,
    "DZD": 2,
    "LYD": 3,
    "XOF": 0,
    "XAF": 0,
    "MUR": 2,
    "ZMW": 2,
    # Asia-Pacific
    "INR": 2,
    "PKR": 2,
    "BDT": 2,
    "LKR": 2,
    "NPR": 2,
    "CNY": 2,
    "HKD": 2,
    "JPY": 0,
    "KRW": 0,
    "SGD": 2,
    "MYR": 2,
    "THB": 2,
    "IDR": 2,
    "PHP": 2,
    "VND": 0,
    "AUD": 2,
    "NZD": 2,
    "TWD": 2,
    # Europe
    "EUR": 2,
    "GBP": 2,
    "CHF": 2,
    "SEK": 2,
    "NOK": 2,
    "DKK": 2,
    "PLN": 2,
    "CZK": 2,
    "HUF": 2,
    "RON": 2,
    "RUB": 2,
    "UAH": 2,
    "ISK": 0,
    # Americas
    "USD": 2,
    "CAD": 2,
    "MXN": 2,
    "BRL": 2,
    "ARS": 2,
    "CLP": 0,
    "COP": 2,
    "PEN": 2,
}


def is_supported(code: str) -> bool:
    return code.upper() in MINOR_UNITS


def minor_units(code: str) -> int:
    return MINOR_UNITS[code.upper()]
