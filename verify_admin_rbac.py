import asyncio
import json
import urllib.request
import urllib.error
import os

BASE_URL = "http://pcrox.ddns.net:8000"

def make_request(method, endpoint, data=None, headers=None):
    url = f"{BASE_URL}{endpoint}"
    if headers is None:
        headers = {}
    
    if data:
        json_data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    else:
        json_data = None

    req = urllib.request.Request(url, data=json_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            try:
                return status, json.loads(body)
            except:
                return status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, body
    except Exception as e:
        return 0, str(e)

async def verify_admin():
    print("Starting Verification...")

    # 1. Register a new user (Potential Admin)
    print("1. Registering 'admin_test'...")
    status, resp = make_request("POST", "/auth/register", {
        "username": "admin_test",
        "email": "admin_test@example.com",
        "password": "password123"
    })
    
    if status == 200:
        print(f"   Registered user ID: {resp['id']}")
    elif status == 400 and "already registered" in str(resp):
        print(f"   User might already exist. Logging in...")
    else:
        print(f"   Error: {status} - {resp}")

    # 2. Login
    print("2. Logging in...")
    # Login requires form data, not JSON
    import urllib.parse
    login_data = urllib.parse.urlencode({
        "username": "admin_test",
        "password": "password123"
    }).encode('utf-8')
    
    req = urllib.request.Request(f"{BASE_URL}/auth/login", data=login_data, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode('utf-8')
            token_resp = json.loads(body)
            token = token_resp["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            print("   Logged in.")
    except Exception as e:
        print(f"   Login Failed: {e}")
        return

    # 3. Try to access Admin Panel (Should FAIL initially)
    print("3. Accessing /admin/users (Expect Failure)...")
    status, resp = make_request("GET", "/admin/users", headers=headers)
    if status == 403:
        print("   SUCCESS: Access Denied (403) as expected.")
    else:
        print(f"   FAILURE: Unexpected status {status}")

    # 4. Manually Assign Admin Role (Backdoor for testing)
    print("4. Assigning Admin Role via DB script...")
    script_content = f"""
import asyncio
from sqlalchemy import text
from backend.db import engine

async def assign():
    async with engine.begin() as conn:
        # Get Admin Role ID
        res = await conn.execute(text("SELECT id FROM roles WHERE name = 'Admin'"))
        role_id = res.scalar()
        
        # Update user
        await conn.execute(
            text("UPDATE users SET role_id = :rid WHERE username = 'admin_test'"),
            {{"rid": role_id}}
        )
        print("Assigned Admin role.")

if __name__ == "__main__":
    asyncio.run(assign())
"""
    with open("temp_assign_role.py", "w") as f:
        f.write(script_content)
        
    os.system("python temp_assign_role.py")
    if os.path.exists("temp_assign_role.py"):
        os.remove("temp_assign_role.py")

    # 5. Try to access Admin Panel (Should SUCCEED now)
    print("5. Accessing /admin/users (Expect Success)...")
    status, resp = make_request("GET", "/admin/users", headers=headers)
    if status == 200:
        print(f"   SUCCESS: Access Granted. Fetched {len(resp)} users.")
    else:
        print(f"   FAILURE: Status {status} - {resp}")

    # 6. Create a new Role
    print("6. Creating 'Support' Role...")
    status, resp = make_request("POST", "/admin/roles", {
        "name": "Support",
        "permissions": json.dumps(["view_reclamations"])
    }, headers=headers)
    
    if status == 200:
        print("   SUCCESS: Role 'Support' created.")
    elif status == 400: # Already exists
        print("   Role 'Support' likely already exists.")
    else:
        print(f"   FAILURE: {status} - {resp}")

    print("\nVerification Complete!")

if __name__ == "__main__":
    asyncio.run(verify_admin())
