"""
Master Statutory Declaration Extraction Engine (PCR 2011 Rule 6).
Orchestrates spatial-semantic extractors across normalized OCR tokens.
"""

from typing import List, Dict, Any
from .mrp import extract_mrp
from .net_quantity import extract_net_quantity
from .unit_sale_price import extract_unit_sale_price
from .dates import extract_dates
from .consumer_care import extract_consumer_care
from .manufacturer import extract_manufacturer
from .country_of_origin import extract_country_of_origin


def extract_all_declarations(tokens: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Executes all statutory declaration extractors on OCR tokens.
    Returns a unified list of extracted declarations.
    """
    if not tokens:
        return []

    declarations = []

    # 1. Net Quantity (Rule 6(1)(c))
    net_qty = extract_net_quantity(tokens)
    if net_qty:
        declarations.append(net_qty)

    # 2. Maximum Retail Price - MRP (Rule 6(1)(e))
    mrp = extract_mrp(tokens)
    if mrp:
        declarations.append(mrp)

    # 3. Unit Sale Price - USP (Rule 6(1)(f))
    usp = extract_unit_sale_price(tokens)
    if usp:
        declarations.append(usp)

    # 4. Dates of Manufacture / Packing / Expiry (Rule 6(1)(d))
    dates = extract_dates(tokens)
    declarations.extend(dates)

    # 5. Manufacturer / Packer Details (Rule 6(1)(a))
    mfg = extract_manufacturer(tokens)
    if mfg:
        declarations.append(mfg)

    # 6. Consumer Care Helpline & Email (Rule 6(1)(n))
    care = extract_consumer_care(tokens)
    if care:
        declarations.append(care)

    # 7. Country of Origin (Rule 6(1)(aa))
    origin = extract_country_of_origin(tokens)
    if origin:
        declarations.append(origin)

    return declarations
