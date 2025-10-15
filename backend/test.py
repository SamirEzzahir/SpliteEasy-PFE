import random
from datetime import datetime, timedelta

# Generate 100 rows
start_date = datetime(2025, 9, 1)
rows = []

for i in range(100):
    date = start_date + timedelta(days=i % 45, hours=random.randint(8, 21))
    desc = random.choice(["Taxi", "Lunch", "Coffee", "Groceries", "Gasoline", "Movie", "Snacks", "Dinner", "Laundry", "Bus"])
    amount = round(random.uniform(5, 150), 2)
    rows.append(f"(47, 1, '{desc}', {amount}, 'MAD', 'general', 'equal', NULL, NULL, '{date:%Y-%m-%d %H:%M:%S}', '{date:%Y-%m-%d %H:%M:%S}')")

sql = "INSERT INTO expenses (group_id, payer_id, description, amount, currency, category, split_type, note, photo, created_at, updated_at)\nVALUES\n" + ",\n".join(rows) + ";"

with open("insert_expenses.sql", "w", encoding="utf-8") as f:
    f.write(sql)

print("✅ SQL file generated: insert_expenses.sql")
