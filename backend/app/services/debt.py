from decimal import Decimal, ROUND_HALF_UP


def round_amount(value) -> Decimal:
    if isinstance(value, Decimal):
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def minimize_cash_flow(balances: dict[int, float]) -> list[dict]:
    """Cash-flow minimization: reduce the number of transactions needed to settle all debts."""
    settlements = []

    creditors = [(uid, round_amount(bal)) for uid, bal in balances.items() if bal > 0]
    debtors = [(uid, round_amount(-bal)) for uid, bal in balances.items() if bal < 0]

    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)

    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        d_uid, debt = debtors[i]
        c_uid, credit = creditors[j]

        pay = round_amount(min(debt, credit))
        if pay > Decimal("0.00"):
            settlements.append({"from_user": d_uid, "to_user": c_uid, "amount": float(pay)})

        debtors[i] = (d_uid, round_amount(debt - pay))
        creditors[j] = (c_uid, round_amount(credit - pay))

        if debtors[i][1] <= Decimal("0.00"):
            i += 1
        if creditors[j][1] <= Decimal("0.00"):
            j += 1

    return settlements
