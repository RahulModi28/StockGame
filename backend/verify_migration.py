from app.database import SessionLocal, get_redis_client, engine
from app import models, schemas, crud

def verify():
    db = SessionLocal()
    redis_client = get_redis_client()
    
    # 1. Create a Test Company
    print("Creating Test Company...")
    test_company = schemas.CompanyCreate(
        name="TestCorp",
        ticker="TEST",
        sector="Tech",
        current_price=100.0,
        total_shares=1000,
        volatility_rating=1.5,
        is_halted=False
    )
    
    # Check if exists to avoid clash
    existing_ticker = db.query(models.Company).filter(models.Company.ticker == "TEST").first()
    if existing_ticker:
        print("Test company exists. Using it.")
        company = existing_ticker
        # Force update redis to match
        redis_client.set(f"company:{company.id}:price", 100.0)
    else:
        company = crud.create_company(db, test_company)
        print(f"Created Company ID: {company.id}")

    # 2. Verify Redis Data
    price = redis_client.get(f"company:{company.id}:price")
    print(f"Redis Price: {price}")
    assert float(price) == 100.0, "Redis price mismatch!"

    # 3. Verify SQL Data
    sql_company = db.query(models.Company).filter(models.Company.id == company.id).first()
    print(f"SQL Company Name: {sql_company.name}")
    assert sql_company.name == "TestCorp", "SQL name mismatch!"
    
    # 4. Verify CRUD Read (Merging)
    merged_company = crud.get_company(db, company.id)
    print(f"Merged Price: {merged_company.current_price}")
    assert merged_company.current_price == 100.0, "Merged price mismatch!"
    
    # 5. Simulate Price Update (Market Logic)
    new_price = 110.0
    redis_client.set(f"company:{company.id}:price", new_price)
    print(f"Updated Redis Price to {new_price}")
    
    merged_company_updated = crud.get_company(db, company.id)
    print(f"Merged Price after update: {merged_company_updated.current_price}")
    assert merged_company_updated.current_price == 110.0, "Price update not reflected!"
    
    print("VERIFICATION SUCCESSFUL!")

if __name__ == "__main__":
    # Ensure tables exist
    models.Base.metadata.create_all(bind=engine)
    verify()
