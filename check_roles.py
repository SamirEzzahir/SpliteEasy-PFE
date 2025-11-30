import asyncio
import json
from sqlalchemy import select
from backend.db import async_session
from backend.models import Role, User

async def check_roles():
    async with async_session() as session:
        print("--- Roles ---")
        result = await session.execute(select(Role))
        roles = result.scalars().all()
        
        if not roles:
            print("⚠️ No roles found! Seeding now...")
            roles_data = [
                {"name": "Admin", "permissions": json.dumps(["*"])},
                {"name": "Moderator", "permissions": json.dumps(["view_dashboard", "view_users", "view_reclamations"])},
                {"name": "User", "permissions": json.dumps([])}
            ]
            for r in roles_data:
                session.add(Role(name=r["name"], permissions=r["permissions"]))
            await session.commit()
            print("✅ Roles seeded.")
            
            # Re-fetch
            result = await session.execute(select(Role))
            roles = result.scalars().all()

        for r in roles:
            print(f"ID: {r.id}, Name: {r.name}")
        
        print("\n--- Users (First 5) ---")
        result = await session.execute(select(User).limit(5))
        users = result.scalars().all()
        for u in users:
            print(f"User: {u.username}, Role ID: {u.role_id}")
            if u.role_id is None:
                 # Assign default role if missing
                 user_role = next((r for r in roles if r.name == "User"), None)
                 if user_role:
                     print(f"   -> Assigning 'User' role to {u.username}")
                     u.role_id = user_role.id
                     session.add(u)
        
        await session.commit()
        print("Done.")

if __name__ == "__main__":
    asyncio.run(check_roles())
