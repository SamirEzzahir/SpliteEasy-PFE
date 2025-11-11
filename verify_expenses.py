"""
Expense Verification Script
This script reads Excel expense data and calculates balances to verify against the project's calculations.
"""

import pandas as pd
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict

def round_amount(value):
    """Round to 2 decimal places using banker's rounding"""
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def calculate_balances_from_excel(file_path):
    """
    Read Excel file and calculate balances for each user.
    Returns: dict with user balances and detailed breakdown
    """
    # Read Excel file
    df = pd.read_excel(file_path)
    
    print("=" * 80)
    print("EXPENSE VERIFICATION REPORT")
    print("=" * 80)
    print(f"\n📊 Total expenses in file: {len(df)}")
    print(f"📋 Columns: {list(df.columns)}\n")
    
    # Track payments and debts
    payments = defaultdict(Decimal)  # Who paid what
    debts = defaultdict(Decimal)     # Who owes what
    
    expense_details = []
    
    # Process each expense
    for idx, row in df.iterrows():
        try:
            # Get expense details
            name = str(row.get("Name", "")).strip()
            amount = Decimal(str(row.get("Paid", 0)))
            payer = str(row.get("Payer", "")).strip()
            
            # Get participants (columns that are not standard fields)
            participant_cols = [col for col in df.columns 
                               if col not in ["ID", "Name", "Paid", "Payer", "Added At", 
                                            "Category", "Note", "Cost Distribution", "Settled", "Created At"]]
            
            # Find who participates (TRUE, 1, YES, X, ✓)
            participants = []
            for col in participant_cols:
                val = row.get(col)
                if pd.notna(val) and str(val).upper() in ["TRUE", "1", "YES", "X", "✓"]:
                    participants.append(col)
            
            if not participants:
                print(f"⚠️ Row {idx+2}: No participants found for '{name}'")
                continue
            
            # Calculate share per person
            share = round_amount(amount / len(participants))
            
            # Record payment
            payments[payer] += round_amount(amount)
            
            # Record debts
            for participant in participants:
                debts[participant] += share
            
            expense_details.append({
                'name': name,
                'amount': float(amount),
                'payer': payer,
                'participants': participants,
                'share_per_person': float(share),
                'total_shares': float(share * len(participants))
            })
            
            print(f"💰 Expense {idx+1}: {name}")
            print(f"   Paid by: {payer} → {float(amount):.2f} MAD")
            print(f"   Split between: {', '.join(participants)} ({len(participants)} people)")
            print(f"   Share per person: {float(share):.2f} MAD")
            print(f"   Total shares: {float(share * len(participants)):.2f} MAD")
            print()
            
        except Exception as e:
            print(f"❌ Error processing row {idx+2}: {e}")
            continue
    
    # Calculate net balances
    print("=" * 80)
    print("BALANCE CALCULATION")
    print("=" * 80)
    print()
    
    balances = {}
    all_users = set(list(payments.keys()) + list(debts.keys()))
    
    for user in all_users:
        paid = payments.get(user, Decimal("0.00"))
        owes = debts.get(user, Decimal("0.00"))
        net = round_amount(paid - owes)
        balances[user] = net
        
        print(f"👤 {user}:")
        print(f"   Paid:     {float(paid):.2f} MAD")
        print(f"   Owes:     {float(owes):.2f} MAD")
        print(f"   Net:      {float(net):.2f} MAD {'(Lent)' if net > 0 else '(Owes)' if net < 0 else '(Even)'}")
        print()
    
    # Calculate totals
    total_paid = sum(payments.values())
    total_owed = sum(debts.values())
    net_balance = sum(balances.values())
    
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total Paid:     {float(total_paid):.2f} MAD")
    print(f"Total Owed:     {float(total_owed):.2f} MAD")
    print(f"Net Balance:    {float(net_balance):.2f} MAD")
    print()
    
    # Calculate suggested settlements
    print("=" * 80)
    print("SUGGESTED SETTLEMENTS")
    print("=" * 80)
    print()
    
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
            print(f"💸 {d_user} → {c_user}: {float(pay):.2f} MAD")
        
        debtors[i] = (d_user, round_amount(debt - pay))
        creditors[j] = (c_user, round_amount(credit - pay))
        
        if debtors[i][1] <= Decimal("0.00"):
            i += 1
        if creditors[j][1] <= Decimal("0.00"):
            j += 1
    
    print()
    print("=" * 80)
    print("VERIFICATION COMPLETE")
    print("=" * 80)
    
    return {
        'balances': {user: float(bal) for user, bal in balances.items()},
        'settlements': settlements,
        'expenses': expense_details
    }

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python verify_expenses.py <path_to_excel_file.xlsx>")
        print("\nExample:")
        print("  python verify_expenses.py expenses.xlsx")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        result = calculate_balances_from_excel(file_path)
        
        print("\n✅ Verification complete!")
        print("\nCompare these results with what your project shows:")
        print(f"   - Balances: {result['balances']}")
        print(f"   - Settlements: {result['settlements']}")
        
    except FileNotFoundError:
        print(f"❌ Error: File '{file_path}' not found")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

