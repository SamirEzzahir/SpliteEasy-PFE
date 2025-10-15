from typing import List, Dict

def minimize_cash_flow(balances: dict[int, float]) -> list[dict]:
    """Return list of settlements as dicts {'from_user':..., 'to_user':..., 'amount':...}"""
    settlements = []
    creditors = [(uid, bal) for uid, bal in balances.items() if bal > 0]
    debtors = [(uid, -bal) for uid, bal in balances.items() if bal < 0]

    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        d_uid, debt = debtors[i]
        c_uid, credit = creditors[j]

        pay = min(debt, credit)
        settlements.append({'from_user': d_uid, 'to_user': c_uid, 'amount': pay})

        debtors[i] = (d_uid, debt - pay)
        creditors[j] = (c_uid, credit - pay)

        if debtors[i][1] == 0:
            i += 1
        if creditors[j][1] == 0:
            j += 1

    return settlements
