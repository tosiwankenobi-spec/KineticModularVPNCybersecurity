"""Idempotent Stripe catalog setup for SENTINEL. Run: python setup_stripe.py"""
from dotenv import load_dotenv
load_dotenv()
import os
import stripe

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"

CATALOG = [
    {"emergent_product_id": "basic_plan", "name": "SENTINEL Basic", "tax_code": "txcd_10103001",
     "prices": [{"lookup_key": "basic_monthly", "amount": 999, "currency": "usd", "interval": "month"}]},
    {"emergent_product_id": "pro_plan", "name": "SENTINEL Pro", "tax_code": "txcd_10103001",
     "prices": [{"lookup_key": "pro_monthly", "amount": 1999, "currency": "usd", "interval": "month"}]},
    {"emergent_product_id": "enterprise_plan", "name": "SENTINEL Enterprise", "tax_code": "txcd_10103001",
     "prices": [{"lookup_key": "enterprise_monthly", "amount": 4999, "currency": "usd", "interval": "month"}]},
]


def get_or_create_product(entry):
    for p in stripe.Product.list(active=True).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            return p
    return stripe.Product.create(name=entry["name"], tax_code=entry.get("tax_code"),
        metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]})


def main():
    for entry in CATALOG:
        product = get_or_create_product(entry)
        for p in entry["prices"]:
            existing = stripe.Price.list(lookup_keys=[p["lookup_key"]], active=True, limit=1).data
            if existing and (existing[0].unit_amount != p["amount"] or existing[0].currency != p["currency"]):
                stripe.Price.modify(existing[0].id, active=False)
                existing = []
            if not existing:
                kwargs = dict(product=product.id, unit_amount=p["amount"], currency=p["currency"],
                              lookup_key=p["lookup_key"], transfer_lookup_key=True)
                if p.get("interval"):
                    kwargs["recurring"] = {"interval": p["interval"]}
                stripe.Price.create(**kwargs)
                print(f"created price {p['lookup_key']}")
            else:
                print(f"price exists {p['lookup_key']}")
    print("catalog ready")


if __name__ == "__main__":
    main()
