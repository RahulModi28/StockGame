from decimal import Decimal

from app.models import Company


def test_company_current_price_maps_to_price_column():
    company = Company(price=Decimal("100.00"))
    assert company.current_price == 100.0

    company.current_price = 250.75
    assert company.price == Decimal("250.75")
    assert company.current_price == 250.75


def test_company_opening_price_defaults_to_price():
    company = Company(price=Decimal("88.50"))
    assert company.opening_price == 88.5
