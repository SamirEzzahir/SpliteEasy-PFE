import asyncio
import json
from sqlalchemy import text
from backend.db import engine, Base
from backend.models import Role, User

async def create_rbac_tables():
    async with engine.begin() as conn:
        # 1. Create new tables
        print("Creating 'roles' and 'reclamations' tables...")
        await conn.run_sync(Base.metadata.create_all)
        
        # 2. Add role_id column to users table if it doesn't exist
        print("Checking for 'role_id' column in 'users' table...")
        try:
            # This is a simple check, in production use Alembic
            await conn.execute(text("ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL"))
            print("Added 'role_id' column.")
        except Exception as e:
            print(f"Column 'role_id' might already exist or error: {e}")

    # 3. Seed Roles and Migrate Admins
    async with engine.begin() as conn:
        print("Seeding default roles...")
        
        # Define roles
        roles_data = [
            {"name": "Admin", "permissions": json.dumps(["*"])},
            {"name": "Moderator", "permissions": json.dumps(["view_dashboard", "view_users", "view_reclamations"])},
            {"name": "User", "permissions": json.dumps([])}
        ]

        for role in roles_data:
            # Check if role exists
            result = await conn.execute(text("SELECT id FROM roles WHERE name = :name"), {"name": role["name"]})
            existing_role = result.scalar()
            
            if not existing_role:
                await conn.execute(
                    text("INSERT INTO roles (name, permissions) VALUES (:name, :permissions)"),
                    role
                )
                print(f"Created role: {role['name']}")
            else:
                print(f"Role {role['name']} already exists.")

        # 4. Migrate existing admins
        print("Migrating existing admins...")
        # Get Admin Role ID
        result = await conn.execute(text("SELECT id FROM roles WHERE name = 'Admin'"))
        admin_role_id = result.scalar()

        # Update users who have is_admin=True (if the column still exists and has data)
        # Note: We removed is_admin from the model but it might still be in the DB
        try:
            await conn.execute(
                text("UPDATE users SET role_id = :role_id WHERE is_admin = true AND role_id IS NULL"),
                {"role_id": admin_role_id}
            )
            print("Migrated existing admins to Admin role.")
        except Exception as e:
            print(f"Could not migrate admins (maybe is_admin column missing?): {e}")
            
        # 5. Set default role for others (User)
        print("Setting default role for other users...")
        result = await conn.execute(text("SELECT id FROM roles WHERE name = 'User'"))
        user_role_id = result.scalar()
        
        await conn.execute(
            text("UPDATE users SET role_id = :role_id WHERE role_id IS NULL"),
            {"role_id": user_role_id}
        )
        print("Set default role for remaining users.")

    print("RBAC Migration Completed Successfully!")

if __name__ == "__main__":
    asyncio.run(create_rbac_tables())
