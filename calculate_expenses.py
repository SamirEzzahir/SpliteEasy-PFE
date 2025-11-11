"""
Manual Calculation of Expenses from Excel Data
"""

from decimal import Decimal, ROUND_HALF_UP

def round_amount(value):
    """Round to 2 decimal places"""
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

# Expense data from Excel
expenses = [
    {"name": "60 sdr djaj bsz", "paid": 60, "payer": "bilal", "split": ["samir", "bilal", "zaki"]},
    {"name": "15 wra9 takos bsz", "paid": 15, "payer": "zaki", "split": ["samir", "bilal", "zaki"]},
    {"name": "8 fromage bsz", "paid": 8, "payer": "zaki", "split": ["samir", "bilal", "zaki"]},
    {"name": "8 botaytos bsz", "paid": 8, "payer": "zaki", "split": ["samir", "bilal", "zaki"]},
    {"name": "170 l7ame bsz", "paid": 170, "payer": "bilal", "split": ["samir", "bilal", "zaki"]},
    {"name": "20 dyal liverison bsz", "paid": 20, "payer": "bilal", "split": ["samir", "bilal", "zaki"]},
    {"name": "60 djaj bsz", "paid": 60, "payer": "bilal", "split": ["samir", "bilal", "zaki"]},
    {"name": "20 atay bsz", "paid": 20, "payer": "zaki", "split": ["samir", "bilal", "zaki"]},
    {"name": "32 souce bsz", "paid": 32, "payer": "zaki", "split": ["samir", "bilal", "zaki"]},
    {"name": "6 barba bs", "paid": 6, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "4 fromage tranch bs", "paid": 4, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "15 pate tacose bs", "paid": 15, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "7 hlib bs", "paid": 7, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "12 pulpy bs", "paid": 12, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "10 banan bs", "paid": 10, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "8 khizo bs", "paid": 8, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "7 maticha bs", "paid": 7, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "7 milk bs", "paid": 7, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "20 zebda bs", "paid": 20, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "26 red cheese bs", "paid": 26, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "16 mozzarila bs", "paid": 16, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "10 dinde fume bs", "paid": 10, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "2 flan bs", "paid": 2, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "24 khbizat *4 bs", "paid": 24, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "12 temar bs", "paid": 12, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "55 djaj bs", "paid": 55, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "20 med ba9al bs", "paid": 20, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "7 temar bs", "paid": 7, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "50 sdar djaj bs", "paid": 50, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "32 red cheese bs", "paid": 32, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "46 djaj bs", "paid": 46, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "20 jalbana bs", "paid": 20, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "10 maticha bs", "paid": 10, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "20 bassela bs", "paid": 20, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "10 fol bs", "paid": 10, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "18 khmira , fino ti7in bs", "paid": 18, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "7 monada fanta bs", "paid": 7, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "15 ziton bs", "paid": 15, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "150 mazot bs", "paid": 150, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "50 sedar djaj bs", "paid": 50, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "52 bota bs", "paid": 52, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "10 dand feme bs", "paid": 10, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "5,5 monada bs", "paid": 5.5, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "10 btata bs", "paid": 10, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "41 souce friomage bs", "paid": 41, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "8 cocacola bs", "paid": 8, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "15 pate tacose bs", "paid": 15, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "28 fromage 500g bs", "paid": 28, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "16 confituer bs", "paid": 16, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "45 sdar djaj bs", "paid": 45, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "20 atay bs", "paid": 20, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "7 sokar bs", "paid": 7, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "15 betata et fruit bs", "paid": 15, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "15 pate tacose bs", "paid": 15, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "4 fromage bs", "paid": 4, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "52 bota bs", "paid": 52, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "25 tide sabon bs", "paid": 25, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "50 sdar djaj bs", "paid": 50, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "58 voltarin s", "paid": 58, "payer": "bilal", "split": ["samir"]},
    {"name": "9 basla bs", "paid": 9, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "7 maticha bs", "paid": 7, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "3 felfla bs", "paid": 3, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "4 khizo bs", "paid": 4, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "50 sdar djaj bs", "paid": 50, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "20 la souse bs", "paid": 20, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "15 pates tacose bs", "paid": 15, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "7 betata bs", "paid": 7, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "54 bota bs", "paid": 54, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "4 betata bs", "paid": 4, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "5 jalbana bs", "paid": 5, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "8 btata bs", "paid": 8, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "4 fromage tranche bs", "paid": 4, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "20 atay bs", "paid": 20, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "7 sokar bs", "paid": 7, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "30 3atria bs", "paid": 30, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "12 3asir bs", "paid": 12, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "94 zit huileur bs", "paid": 94, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "12 solis bs", "paid": 12, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "13 tone bs", "paid": 13, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "8 les pats bs", "paid": 8, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "20 l7ot bs", "paid": 20, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "30 djaj bs", "paid": 30, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "12 pulpy bs", "paid": 12, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "4 khobz bs", "paid": 4, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "3 basla bs", "paid": 3, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "2 toma bs", "paid": 2, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "5 zebib bs", "paid": 5, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "5 loz bs", "paid": 5, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "25 djaj bs", "paid": 25, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "20 djaj bs", "paid": 20, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "6 basla bs", "paid": 6, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "6 khobs bs", "paid": 6, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "5 zebib bs", "paid": 5, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "35 djaj bs", "paid": 35, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "15 btata et khizo bs", "paid": 15, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "8 khobz bs", "paid": 8, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "5 ziton bs", "paid": 5, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "22 algerian bs", "paid": 22, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "42 souce fromage bs", "paid": 42, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "30 djaj bs", "paid": 30, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "10 betata bs", "paid": 10, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "15 pate tacose bs", "paid": 15, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "8 machroba bs", "paid": 8, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "9 fromage tranch bs", "paid": 9, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "12 fruit bs", "paid": 12, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "20 atay bs", "paid": 20, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "40 melangeur douch bs", "paid": 40, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "20 temar o chebakia bs", "paid": 20, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "42 djaj bs", "paid": 42, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "60 khodra bs", "paid": 60, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "6 eggs bs", "paid": 6, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "4 khobz bs", "paid": 4, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "7 mandarin bs", "paid": 7, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "6 lbid bs", "paid": 6, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "10 atay bs", "paid": 10, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "4 goldn bs", "paid": 4, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "6 eeggs bs", "paid": 6, "payer": "bilal", "split": ["samir", "bilal"]},
    {"name": "5 bread bs", "paid": 5, "payer": "bilal", "split": ["samir", "bilal"]},
]

# Calculate balances
payments = {"samir": Decimal("0"), "bilal": Decimal("0"), "zaki": Decimal("0")}
debts = {"samir": Decimal("0"), "bilal": Decimal("0"), "zaki": Decimal("0")}

print("=" * 80)
print("EXPENSE CALCULATION VERIFICATION")
print("=" * 80)
print()

for exp in expenses:
    amount = Decimal(str(exp["paid"]))
    payer = exp["payer"]
    participants = exp["split"]
    
    # Record payment
    payments[payer] += round_amount(amount)
    
    # Calculate share per person
    share = round_amount(amount / len(participants))
    
    # Record debts
    for participant in participants:
        debts[participant] += share

# Calculate net balances
balances = {}
for user in ["samir", "bilal", "zaki"]:
    paid = payments[user]
    owes = debts[user]
    net = round_amount(paid - owes)
    balances[user] = net

print("BALANCES:")
print("-" * 80)
for user in ["samir", "bilal", "zaki"]:
    print(f"{user.upper()}:")
    print(f"  Paid:  {float(payments[user]):.2f} MAD")
    print(f"  Owes:  {float(debts[user]):.2f} MAD")
    print(f"  Net:   {float(balances[user]):.2f} MAD {'(Lent)' if balances[user] > 0 else '(Owes)' if balances[user] < 0 else '(Even)'}")
    print()

print("=" * 80)
print("SUGGESTED SETTLEMENTS:")
print("-" * 80)

creditors = [(user, bal) for user, bal in balances.items() if bal > 0]
debtors = [(user, -bal) for user, bal in balances.items() if bal < 0]

creditors.sort(key=lambda x: x[1], reverse=True)
debtors.sort(key=lambda x: x[1], reverse=True)

settlements = []
i, j = 0, 0

while i < len(debtors) and j < len(creditors):
    d_user, debt = debtors[i]
    c_user, credit = creditors[j]
    
    pay = round_amount(min(debt, credit))
    
    if pay > Decimal("0.00"):
        settlements.append({
            'from': d_user,
            'to': c_user,
            'amount': float(pay)
        })
        print(f"{d_user.upper()} → {c_user.upper()}: {float(pay):.2f} MAD")
    
    debtors[i] = (d_user, round_amount(debt - pay))
    creditors[j] = (c_user, round_amount(credit - pay))
    
    if debtors[i][1] <= Decimal("0.00"):
        i += 1
    if creditors[j][1] <= Decimal("0.00"):
        j += 1

print()
print("=" * 80)
total_paid = sum(payments.values())
total_owed = sum(debts.values())
net_total = sum(balances.values())
print(f"Total Paid:  {float(total_paid):.2f} MAD")
print(f"Total Owed:  {float(total_owed):.2f} MAD")
print(f"Net Balance: {float(net_total):.2f} MAD")
print("=" * 80)

