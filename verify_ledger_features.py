import asyncio
import json
import urllib.request
import urllib.parse
import urllib.error

API_URL = "http://localhost:8000"

def make_request(method, endpoint, data=None, headers=None):
    if headers is None:
        headers = {}
    
    url = f"{API_URL}{endpoint}"
    
    if data is not None:
        data_bytes = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    else:
        data_bytes = None

    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode()
            try:
                return response.status, json.loads(body)
            except json.JSONDecodeError:
                print(f"Failed to decode JSON. Raw body: {body}")
                return response.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def verify():
    # 0. Register (to ensure user exists)
    print("Registering test user...")
    reg_data = {"username": "testuser_ledger", "email": "test_ledger@example.com", "password": "password123"}
    status, reg_res = make_request("POST", "/auth/register", reg_data)
    if status == 200:
        print("Registration successful.")
    elif status == 400 and "already registered" in str(reg_res):
        print("User already exists, proceeding to login.")
    else:
        print(f"Registration failed: {reg_res}")
        return

    # 1. Login
    print("Logging in...")
    # Login endpoint expects form data, not JSON
    login_data = urllib.parse.urlencode({"username": "testuser_ledger", "password": "password123"}).encode()
    req = urllib.request.Request(f"{API_URL}/auth/login", data=login_data, method="POST")
    
    try:
        with urllib.request.urlopen(req) as response:
            token_data = json.loads(response.read().decode())
            token = token_data["access_token"]
            print("Login successful.")
    except urllib.error.HTTPError as e:
        print(f"Login failed: {e.read().decode()}")
        return

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Income Source
    print("\nCreating Income Source...")
    status, source = make_request("POST", "/econome/income-sources", {"name": "Test Salary"}, headers)
    if status == 200:
        print(f"Created source: {source}")
        source_id = source["id"]
    else:
        print(f"Failed to create source: {source}")
        return

    # 3. Get Income Sources
    print("\nFetching Income Sources...")
    status, sources = make_request("GET", "/econome/income-sources", headers=headers)
    print(f"Sources: {sources}")

    # 4. Distribute Income
    print("\nDistributing Income...")
    # Get a strategy first
    status, strategies = make_request("GET", "/econome/strategies", headers=headers)
    strategy_id = strategies[0]["id"]
    
    # Query params need to be encoded
    params = urllib.parse.urlencode({
        "amount": 1000,
        "strategy_id": strategy_id,
        "description": "Test Salary"
    })
    
    status, dist_res = make_request("POST", f"/econome/distribute?{params}", headers=headers)
    print(f"Distribute response: {dist_res}")

    # 5. Get Monthly Summary
    print("\nFetching Monthly Summary...")
    status, summary = make_request("GET", "/econome/monthly-summary", headers=headers)
    print(f"Summary: {summary}")

    # 6. Clean up (Delete Income Source)
    print("\nDeleting Income Source...")
    status, del_res = make_request("DELETE", f"/econome/income-sources/{source_id}", headers=headers)
    print(f"Delete response status: {status}")

if __name__ == "__main__":
    verify()
