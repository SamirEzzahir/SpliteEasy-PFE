"""
Standalone script to fix debts and loans tables schema
Run this manually if the migration doesn't work
Run from project root: python backend/fix_debts_loans_tables.py
Or from backend directory: python fix_debts_loans_tables.py
"""
import asyncio
import sys
import os

# Add project root to path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlalchemy import text
from backend.db import engine

async def fix_debts_loans_tables():
    """Force fix debts and loans tables by dropping and recreating them."""
    async with engine.begin() as conn:
        print("Fixing debts and loans tables...")
        
        try:
            # Drop dependent tables first
            print("   Dropping debt_repayments...")
            await conn.execute(text("DROP TABLE IF EXISTS debt_repayments"))
            
            print("   Dropping loan_repayments...")
            await conn.execute(text("DROP TABLE IF EXISTS loan_repayments"))
            
            # Drop main tables
            print("   Dropping debts...")
            await conn.execute(text("DROP TABLE IF EXISTS debts"))
            
            print("   Dropping loans...")
            await conn.execute(text("DROP TABLE IF EXISTS loans"))
            
            # Recreate debts table
            print("   Creating debts table...")
            await conn.execute(text("""
                CREATE TABLE debts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    lender_name VARCHAR(200) NOT NULL,
                    original_amount DECIMAL(12, 2) NOT NULL,
                    remaining_amount DECIMAL(12, 2) NOT NULL,
                    status ENUM('active', 'partially_paid', 'fully_paid') DEFAULT 'active',
                    wallet_id INT NULL,
                    due_date DATETIME NULL,
                    note VARCHAR(500) NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL,
                    INDEX idx_user_id (user_id)
                )
            """))
            print("   Created debts table")
            
            # Recreate loans table
            print("   Creating loans table...")
            await conn.execute(text("""
                CREATE TABLE loans (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    borrower_name VARCHAR(200) NOT NULL,
                    original_amount DECIMAL(12, 2) NOT NULL,
                    remaining_amount DECIMAL(12, 2) NOT NULL,
                    status ENUM('active', 'partially_paid', 'fully_paid') DEFAULT 'active',
                    wallet_id INT NULL,
                    due_date DATETIME NULL,
                    note VARCHAR(500) NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL,
                    INDEX idx_user_id (user_id)
                )
            """))
            print("   Created loans table")
            
            # Recreate debt_repayments table
            print("   Creating debt_repayments table...")
            await conn.execute(text("""
                CREATE TABLE debt_repayments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    debt_id INT NOT NULL,
                    amount DECIMAL(12, 2) NOT NULL,
                    wallet_id INT NULL,
                    note VARCHAR(500) NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
                    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL,
                    INDEX idx_debt_id (debt_id)
                )
            """))
            print("   Created debt_repayments table")
            
            # Recreate loan_repayments table
            print("   Creating loan_repayments table...")
            await conn.execute(text("""
                CREATE TABLE loan_repayments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    loan_id INT NOT NULL,
                    amount DECIMAL(12, 2) NOT NULL,
                    wallet_id INT NULL,
                    note VARCHAR(500) NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
                    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL,
                    INDEX idx_loan_id (loan_id)
                )
            """))
            print("   Created loan_repayments table")
            
            print("\nAll tables fixed successfully!")
            
        except Exception as e:
            print(f"\nError fixing tables: {e}")
            import traceback
            traceback.print_exc()
            raise

if __name__ == "__main__":
    asyncio.run(fix_debts_loans_tables())

