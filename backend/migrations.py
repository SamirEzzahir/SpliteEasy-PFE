"""
Database migration utilities
"""
from sqlalchemy import text
from backend.db import engine

async def migrate_settlements_table():
    """Add new columns to settlements table if they don't exist."""
    
    async with engine.begin() as conn:
        print("🔄 Checking settlements table migration...")
        
        migrations = [
            ("status", "ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending'"),
            ("message", "VARCHAR(500) NULL"),
            ("proof_photo", "VARCHAR(255) NULL"),
            ("rejected_reason", "VARCHAR(500) NULL"),
            ("updated_at", "DATETIME NULL"),
        ]
        
        for column_name, column_def in migrations:
            try:
                # Check if column exists (MySQL syntax)
                check_query = text(f"""
                    SELECT COUNT(*) as count 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'settlements' 
                    AND COLUMN_NAME = '{column_name}'
                """)
                
                result = await conn.execute(check_query)
                row = result.fetchone()
                column_exists = row and row[0] > 0
                
                if not column_exists:
                    print(f"➕ Adding column: {column_name}...")
                    
                    if column_name == "status":
                        alter_query = text(f"""
                            ALTER TABLE settlements 
                            ADD COLUMN {column_name} {column_def}
                        """)
                        await conn.execute(alter_query)
                        
                        # Update existing records to 'accepted'
                        update_query = text("""
                            UPDATE settlements 
                            SET status = 'accepted' 
                            WHERE status IS NULL OR status = ''
                        """)
                        await conn.execute(update_query)
                    elif column_name == "updated_at":
                        alter_query = text(f"""
                            ALTER TABLE settlements 
                            ADD COLUMN {column_name} DATETIME NULL
                        """)
                        await conn.execute(alter_query)
                        
                        # Set updated_at to created_at for existing records
                        update_query = text("""
                            UPDATE settlements 
                            SET updated_at = created_at 
                            WHERE updated_at IS NULL
                        """)
                        await conn.execute(update_query)
                    else:
                        alter_query = text(f"""
                            ALTER TABLE settlements 
                            ADD COLUMN {column_name} {column_def}
                        """)
                        await conn.execute(alter_query)
                    
                    print(f"✅ Added column: {column_name}")
                    
            except Exception as e:
                print(f"⚠️  Could not add column {column_name}: {e}")
                # Continue with other columns
        
        print("✅ Settlements table migration check completed!")


async def migrate_global_settlement_mode():
    """Add global_settlement_mode column to users table if it doesn't exist."""
    async with engine.begin() as conn:
        print("🔄 Checking global_settlement_mode migration...")
        try:
            # Check if column exists (MySQL syntax)
            check_query = text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'global_settlement_mode'
            """)
            
            result = await conn.execute(check_query)
            row = result.fetchone()
            column_exists = row and row[0] > 0
            
            if not column_exists:
                print("➕ Adding column: global_settlement_mode...")
                alter_query = text("""
                    ALTER TABLE users
                    ADD COLUMN global_settlement_mode VARCHAR(20) DEFAULT 'separate'
                """)
                await conn.execute(alter_query)
                print("✅ Added column: global_settlement_mode")
            else:
                print("✅ Column global_settlement_mode already exists.")
                
        except Exception as e:
            print(f"⚠️  Could not add column global_settlement_mode: {e}")
            # Column might already exist, which is fine
            if "Duplicate column name" not in str(e):
                raise
        
        print("✅ Global settlement mode migration check completed!")


async def migrate_transactions_to_wallet_id():
    """Make to_wallet_id nullable in transactions table for payments"""
    async with engine.begin() as conn:
        print("🔄 Checking transactions table for to_wallet_id migration...")
        
        try:
            # Check if column is nullable
            check_query = text("""
                SELECT IS_NULLABLE 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'transactions' 
                AND COLUMN_NAME = 'to_wallet_id'
            """)
            
            result = await conn.execute(check_query)
            row = result.fetchone()
            
            if row and row[0] == 'YES':
                print("✅ Column to_wallet_id is already nullable in transactions table.")
                return
            
            if row and row[0] == 'NO':
                print("➕ Making to_wallet_id nullable in transactions table...")
                alter_query = text("""
                    ALTER TABLE transactions 
                    MODIFY COLUMN to_wallet_id INT NULL
                """)
                await conn.execute(alter_query)
                print("✅ Made to_wallet_id nullable in transactions table.")
            else:
                print("⚠️  Column to_wallet_id not found in transactions table.")
                
        except Exception as e:
            print(f"⚠️  Could not modify to_wallet_id column in transactions table: {e}")
        
        print("✅ Transactions table to_wallet_id migration check completed!")


async def migrate_transactions_transaction_type():
    """Add transaction_type column to transactions table if it doesn't exist."""
    async with engine.begin() as conn:
        print("🔄 Checking transactions table for transaction_type migration...")
        
        try:
            # Check if column exists
            check_query = text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'transactions'
                AND COLUMN_NAME = 'transaction_type'
            """)
            
            result = await conn.execute(check_query)
            row = result.fetchone()
            column_exists = row and row[0] > 0
            
            if not column_exists:
                print("➕ Adding column: transaction_type...")
                alter_query = text("""
                    ALTER TABLE transactions
                    ADD COLUMN transaction_type ENUM('transfer', 'debt', 'credit') DEFAULT 'transfer'
                """)
                await conn.execute(alter_query)
                
                # Update existing records with to_wallet_id = NULL to be 'debt' type
                # (assuming they were payments/debts)
                update_query = text("""
                    UPDATE transactions
                    SET transaction_type = 'debt'
                    WHERE to_wallet_id IS NULL
                """)
                await conn.execute(update_query)
                
                # Update any empty strings or NULL values to 'transfer'
                update_empty_query = text("""
                    UPDATE transactions
                    SET transaction_type = 'transfer'
                    WHERE transaction_type IS NULL 
                    OR transaction_type = ''
                    OR transaction_type NOT IN ('transfer', 'debt', 'credit')
                """)
                await conn.execute(update_empty_query)
            else:
                # Column exists, but check for empty strings and fix them
                print("🔧 Checking for empty transaction_type values...")
                update_empty_query = text("""
                    UPDATE transactions
                    SET transaction_type = 'transfer'
                    WHERE transaction_type IS NULL 
                    OR transaction_type = ''
                    OR transaction_type NOT IN ('transfer', 'debt', 'credit')
                """)
                await conn.execute(update_empty_query)
                print("✅ Fixed any empty transaction_type values")
                
                print("✅ Column transaction_type already exists.")
                
        except Exception as e:
            print(f"⚠️  Could not add column transaction_type: {e}")
        
        print("✅ Transactions table transaction_type migration check completed!")


async def migrate_debts_loans_tables():
    """Create debts and loans tables if they don't exist, or fix schema if incorrect."""
    async with engine.begin() as conn:
        print("🔄 Creating/fixing debts and loans tables...")
        
        # Check and create/fix debts table
        try:
            check_debts = text("""
                SELECT COUNT(*) as count
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'debts'
            """)
            result = await conn.execute(check_debts)
            row = result.fetchone()
            debts_exists = row and row[0] > 0
            
            if not debts_exists:
                print("➕ Creating debts table...")
                create_debts = text("""
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
                """)
                await conn.execute(create_debts)
                print("✅ Created debts table")
            else:
                # Check if lender_name column exists
                check_column = text("""
                    SELECT COUNT(*) as count
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'debts'
                    AND COLUMN_NAME = 'lender_name'
                """)
                result = await conn.execute(check_column)
                row = result.fetchone()
                has_lender_name = row and row[0] > 0
                
                if not has_lender_name:
                    print("WARNING: Debts table exists but missing lender_name column. Dropping and recreating...")
                    # Drop dependent tables first (due to foreign keys)
                    try:
                        drop_debt_repayments = text("DROP TABLE IF EXISTS debt_repayments")
                        await conn.execute(drop_debt_repayments)
                        print("   Dropped debt_repayments table")
                    except Exception as e:
                        print(f"   Note: Could not drop debt_repayments: {e}")
                    
                    # Drop the debts table
                    try:
                        drop_debts = text("DROP TABLE IF EXISTS debts")
                        await conn.execute(drop_debts)
                        print("   Dropped debts table")
                    except Exception as e:
                        print(f"   Error dropping debts table: {e}")
                        raise
                    
                    # Recreate with correct schema
                    create_debts = text("""
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
                    """)
                    await conn.execute(create_debts)
                    print("Recreated debts table with correct schema")
                    
                    # Recreate debt_repayments table
                    try:
                        create_debt_repayments = text("""
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
                        """)
                        await conn.execute(create_debt_repayments)
                        print("Recreated debt_repayments table")
                    except Exception as e:
                        print(f"   Note: Could not recreate debt_repayments: {e}")
                else:
                    print("Debts table already exists with correct schema")
        except Exception as e:
            print(f"⚠️  Error with debts table: {e}")
        
        # Check and create/fix loans table
        try:
            check_loans = text("""
                SELECT COUNT(*) as count
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'loans'
            """)
            result = await conn.execute(check_loans)
            row = result.fetchone()
            loans_exists = row and row[0] > 0
            
            if not loans_exists:
                print("➕ Creating loans table...")
                create_loans = text("""
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
                """)
                await conn.execute(create_loans)
                print("✅ Created loans table")
            else:
                # Check if borrower_name column exists
                check_column = text("""
                    SELECT COUNT(*) as count
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'loans'
                    AND COLUMN_NAME = 'borrower_name'
                """)
                result = await conn.execute(check_column)
                row = result.fetchone()
                has_borrower_name = row and row[0] > 0
                
                if not has_borrower_name:
                    print("WARNING: Loans table exists but missing borrower_name column. Dropping and recreating...")
                    # Drop dependent tables first (due to foreign keys)
                    try:
                        drop_loan_repayments = text("DROP TABLE IF EXISTS loan_repayments")
                        await conn.execute(drop_loan_repayments)
                        print("   Dropped loan_repayments table")
                    except Exception as e:
                        print(f"   Note: Could not drop loan_repayments: {e}")
                    
                    # Drop the loans table
                    try:
                        drop_loans = text("DROP TABLE IF EXISTS loans")
                        await conn.execute(drop_loans)
                        print("   Dropped loans table")
                    except Exception as e:
                        print(f"   Error dropping loans table: {e}")
                        raise
                    
                    # Recreate with correct schema
                    create_loans = text("""
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
                    """)
                    await conn.execute(create_loans)
                    print("Recreated loans table with correct schema")
                    
                    # Recreate loan_repayments table
                    try:
                        create_loan_repayments = text("""
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
                        """)
                        await conn.execute(create_loan_repayments)
                        print("Recreated loan_repayments table")
                    except Exception as e:
                        print(f"   Note: Could not recreate loan_repayments: {e}")
                else:
                    print("Loans table already exists with correct schema")
        except Exception as e:
            print(f"⚠️  Error with loans table: {e}")
        
        # Check and create debt_repayments table
        try:
            check_debt_repayments = text("""
                SELECT COUNT(*) as count
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'debt_repayments'
            """)
            result = await conn.execute(check_debt_repayments)
            row = result.fetchone()
            debt_repayments_exists = row and row[0] > 0
            
            if not debt_repayments_exists:
                print("➕ Creating debt_repayments table...")
                create_debt_repayments = text("""
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
                """)
                await conn.execute(create_debt_repayments)
                print("✅ Created debt_repayments table")
            else:
                print("✅ Debt repayments table already exists")
        except Exception as e:
            print(f"⚠️  Error with debt_repayments table: {e}")
        
        # Check and create loan_repayments table
        try:
            check_loan_repayments = text("""
                SELECT COUNT(*) as count
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'loan_repayments'
            """)
            result = await conn.execute(check_loan_repayments)
            row = result.fetchone()
            loan_repayments_exists = row and row[0] > 0
            
            if not loan_repayments_exists:
                print("➕ Creating loan_repayments table...")
                create_loan_repayments = text("""
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
                """)
                await conn.execute(create_loan_repayments)
                print("✅ Created loan_repayments table")
            else:
                print("✅ Loan repayments table already exists")
        except Exception as e:
            print(f"⚠️  Error with loan_repayments table: {e}")
        
        print("✅ Debts & Loans tables migration completed!")


async def run_migrations():
    """Run all migrations."""
    await migrate_settlements_table()
    await migrate_global_settlement_mode()
    await migrate_transactions_to_wallet_id()
    await migrate_transactions_transaction_type()
    await migrate_debts_loans_tables()

