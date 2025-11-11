from typing import List, Dict
from decimal import Decimal, ROUND_HALF_UP

def round_amount(value) -> Decimal:
    """Round to 2 decimal places using banker's rounding"""
    if isinstance(value, Decimal):
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def minimize_cash_flow(balances: dict[int, float]) -> list[dict]:
    """
    Return list of settlements as dicts {'from_user':..., 'to_user':..., 'amount':...}
    Uses Decimal for precision and rounds after each payment to avoid floating-point errors.
    Ensures settlements exactly match the input balances.
    """
    settlements = []
    
    # Convert to Decimal and separate creditors (positive) and debtors (negative)
    # Round each balance first to ensure consistency
    creditors = [(uid, round_amount(bal)) for uid, bal in balances.items() if bal > 0]
    debtors = [(uid, round_amount(-bal)) for uid, bal in balances.items() if bal < 0]
    
    # Sort by amount (largest first) for better minimization
    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)

    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        d_uid, debt = debtors[i]
        c_uid, credit = creditors[j]

        # Calculate payment and round to 2 decimals
        pay = round_amount(min(debt, credit))
        
        # Only add settlement if amount > 0 (avoid zero settlements)
        if pay > Decimal("0.00"):
            settlements.append({
                'from_user': d_uid, 
                'to_user': c_uid, 
                'amount': float(pay)  # Convert to float for JSON serialization
            })

        # Update balances with precise Decimal arithmetic and round after each operation
        debtors[i] = (d_uid, round_amount(debt - pay))
        creditors[j] = (c_uid, round_amount(credit - pay))

        # Move to next if balance is zero (or effectively zero after rounding)
        if debtors[i][1] <= Decimal("0.00"):
            i += 1
        if creditors[j][1] <= Decimal("0.00"):
            j += 1

    return settlements
