# Group summary currency display

On **Groups**, use **Summary currency** above the cards:

- **By currency** shows recorded totals separately for each currency.
- **Approximate total (MAD/USD/…)** converts the three monetary cards to the
  currency selected in Settings. The group count stays a count.

The choice is remembered in the browser. Conversion uses one consistent rate
snapshot and the provider's actual update timestamp. It never changes expenses,
balances, settlements or the amounts payable. These are estimates, not bank quotes.
Missing rates never result in a partially converted total. Original totals remain
available using **By currency**.

## Default: no key, no subscription

The backend uses [ExchangeRate-API's open endpoint](https://www.exchangerate-api.com/docs/free).
It updates **daily**, supports MAD and other supported app currencies, and requires
the attribution link displayed beside the estimates. Responses are cached until
the provider's next update and shared across users. Refreshing the UI does not
force extra provider requests or turn daily data into real-time data.

## Optional: more frequent updates

Use [CurrencyAPI](https://currencyapi.com/docs/latest) with a plan supporting your
desired frequency. Its free plan is daily; paid plans can update as often as every
minute. In the server's root `.env` for Docker Compose (or `backend/.env` locally):

```dotenv
CURRENCY_API_KEY=your-private-key
CURRENCY_API_REFRESH_SECONDS=60
```

Match the interval to the provider plan and request quota. The default is 3600
seconds when a key is configured; supported intervals are clamped to 60–86400
seconds. For a daily-only key use 86400. With Docker, recreate the backend after
configuration changes:

```sh
docker compose up -d --build backend frontend
```

The key stays on the backend and is never included in public settings or browser
requests. Only rate data is requested from the provider; group/user amounts are
not sent. No subscription is created or paid plan activated by the app.

## Refresh and outages

Visible converted summaries refresh automatically according to the backend's
cache expiry. Hidden tabs pause requests and check again when visible. A manual
refresh button retries within the same server-side cache policy.

On provider failure, the last successful snapshot may be used for up to seven
days, clearly marked as older rates with its original timestamp. Older snapshots
are rejected. Without usable rates, affected cards show **Conversion unavailable**.
Daily data is never labelled live.

Checks: `node scripts/check-currency-conversion.cjs` and
`python -m pytest tests/test_exchange_rates.py` from `backend`.
