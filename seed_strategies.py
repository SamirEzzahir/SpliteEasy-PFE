import asyncio
from sqlalchemy import select
from backend.db import engine, async_session
from backend.models import JarStrategy

DEFAULT_STRATEGIES = [
    {
        "name": "T. Harv Eker",
        "nec": 0.55, "ffa": 0.10, "edu": 0.10, "ltss": 0.10, "play": 0.10, "give": 0.05
    },
    {
        "name": "Improved",
        "nec": 0.47, "ffa": 0.30, "edu": 0.10, "ltss": 0.05, "play": 0.03, "give": 0.05
    },
    {
        "name": "Économé",
        "nec": 0.47, "ffa": 0.15, "edu": 0.17, "ltss": 0.13, "play": 0.03, "give": 0.05
    }
]

async def seed_defaults():
    async with async_session() as db:
        print("Checking for existing strategies...")
        result = await db.execute(select(JarStrategy).where(JarStrategy.user_id == None))
        existing = result.scalars().all()
        
        existing_names = {s.name for s in existing}
        
        new_strategies = []
        for s in DEFAULT_STRATEGIES:
            if s["name"] not in existing_names:
                print(f"Adding default strategy: {s['name']}")
                new_strategies.append(JarStrategy(**s, user_id=None))
            else:
                print(f"Strategy {s['name']} already exists.")
        
        if new_strategies:
            db.add_all(new_strategies)
            await db.commit()
            print("Defaults seeded successfully.")
        else:
            print("No new defaults to add.")

if __name__ == "__main__":
    asyncio.run(seed_defaults())
