-- Add missing columns to companies table for stock prices and trading status
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS price FLOAT DEFAULT 100.0,
ADD COLUMN IF NOT EXISTS is_halted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Now insert sample companies
INSERT INTO companies (name, ticker, sector, price, is_halted, total_shares) VALUES
-- Technology Sector
('Apple Inc.', 'AAPL', 'Technology', 182.50, false, 1000000),
('Microsoft Corporation', 'MSFT', 'Technology', 378.65, false, 1000000),
('Alphabet Inc.', 'GOOGL', 'Technology', 139.85, false, 1000000),
('Amazon.com Inc.', 'AMZN', 'Technology', 172.89, false, 1000000),
('NVIDIA Corporation', 'NVDA', 'Technology', 495.30, false, 1000000),
('Meta Platforms Inc.', 'META', 'Technology', 348.92, false, 1000000),
('Tesla Inc.', 'TSLA', 'Automotive', 248.92, false, 1000000),
('Netflix Inc.', 'NFLX', 'Entertainment', 485.50, false, 1000000),

-- Finance Sector
('JPMorgan Chase & Co.', 'JPM', 'Finance', 158.75, false, 1000000),
('Bank of America Corp.', 'BAC', 'Finance', 34.82, false, 1000000),
('Goldman Sachs Group', 'GS', 'Finance', 389.45, false, 1000000),
('Morgan Stanley', 'MS', 'Finance', 95.67, false, 1000000),

-- Healthcare Sector
('Johnson & Johnson', 'JNJ', 'Healthcare', 156.32, false, 1000000),
('Pfizer Inc.', 'PFE', 'Healthcare', 28.45, false, 1000000),
('UnitedHealth Group', 'UNH', 'Healthcare', 512.88, false, 1000000),
('Moderna Inc.', 'MRNA', 'Healthcare', 95.23, false, 1000000),

-- Consumer Goods
('The Coca-Cola Company', 'KO', 'Consumer Goods', 61.23, false, 1000000),
('PepsiCo Inc.', 'PEP', 'Consumer Goods', 175.45, false, 1000000),
('Procter & Gamble Co.', 'PG', 'Consumer Goods', 152.34, false, 1000000),
('Nike Inc.', 'NKE', 'Consumer Goods', 108.76, false, 1000000),

-- Energy Sector
('Exxon Mobil Corporation', 'XOM', 'Energy', 102.45, false, 1000000),
('Chevron Corporation', 'CVX', 'Energy', 148.92, false, 1000000),

-- Retail
('Walmart Inc.', 'WMT', 'Retail', 165.43, false, 1000000),
('Target Corporation', 'TGT', 'Retail', 142.56, false, 1000000),
('Costco Wholesale', 'COST', 'Retail', 698.34, false, 1000000),

-- Telecommunications
('Verizon Communications', 'VZ', 'Telecommunications', 41.23, false, 1000000),
('AT&T Inc.', 'T', 'Telecommunications', 19.87, false, 1000000),

-- Industrial
('Boeing Company', 'BA', 'Industrial', 178.92, false, 1000000),
('Caterpillar Inc.', 'CAT', 'Industrial', 298.45, false, 1000000),
('General Electric', 'GE', 'Industrial', 125.67, false, 1000000)

ON CONFLICT (ticker) DO UPDATE SET
    name = EXCLUDED.name,
    sector = EXCLUDED.sector,
    price = EXCLUDED.price,
    is_halted = EXCLUDED.is_halted,
    total_shares = EXCLUDED.total_shares;

-- Verify the data was inserted
SELECT COUNT(*) as total_companies FROM companies;
SELECT sector, COUNT(*) as count FROM companies GROUP BY sector ORDER BY count DESC;
SELECT name, ticker, price FROM companies ORDER BY sector, name LIMIT 10;
