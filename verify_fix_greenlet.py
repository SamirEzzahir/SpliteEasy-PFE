import asyncio
import urllib.request
import urllib.error
import json
import urllib.parse

BASE_URL = "http://pcrox.ddns.net:8080"

async def verify_fix():
    print("Verifying fix for MissingGreenlet error...")

    import random
    rand_id = random.randint(1000, 9999)
    username = f"admin_test_{rand_id}"
    email = f"admin_test_{rand_id}@example.com"
    password = "password123"

    # 0. Register user (if not exists)
    print(f"0. Registering '{username}'...")
    try:
        reg_req = urllib.request.Request(
            f"{BASE_URL}/auth/register", 
            data=json.dumps({
                "username": username, 
                "email": email, 
                "password": password
            }).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method="POST"
        )
        with urllib.request.urlopen(reg_req) as response:
            print("   Registered successfully.")
    except urllib.error.HTTPError as e:
        print(f"   Registration: {e.code} (User likely exists)")
    except Exception as e:
        print(f"   Registration Error: {e}")
    
    # 1. Login to get token
    print("1. Logging in...")
    login_data = urllib.parse.urlencode({
        "username": username,
        "password": password
    }).encode('utf-8')
    
    try:
        req = urllib.request.Request(f"{BASE_URL}/auth/login", data=login_data, method="POST")
        with urllib.request.urlopen(req) as response:
            body = response.read().decode('utf-8')
            token_resp = json.loads(body)
            token = token_resp["access_token"]
            print("   Logged in successfully.")
    except Exception as e:
        print(f"   Login Failed: {e}")
        return

    # 2. Fetch /users/user/me
    print("2. Fetching /users/user/me...")
    req = urllib.request.Request(f"{BASE_URL}/users/user/me", headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as response:
            if response.getcode() == 200:
                user = json.loads(response.read().decode('utf-8'))
                print(f"   SUCCESS: Fetched user '{user['username']}'")
                if 'role' in user:
                    print(f"   Role loaded: {user['role']}")
                else:
                    print("   WARNING: Role field missing in response (check schema)")
            else:
                print(f"   FAILURE: Status {response.getcode()}")
    except urllib.error.HTTPError as e:
        print(f"   FAILURE: {e.code} - {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"   Error: {e}")

    # 3. Fetch /auth/me
    print("3. Fetching /auth/me...")
    req = urllib.request.Request(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as response:
            if response.getcode() == 200:
                user = json.loads(response.read().decode('utf-8'))
                print(f"   FULL JSON: {json.dumps(user)}")
                print(f"   SUCCESS: Fetched user '{user['username']}' via /auth/me")
                if 'role' in user and user['role']:
                    print(f"   Role: {user['role']['name']}")
                else:
                    print("   WARNING: User has no role!")
            else:
                print(f"   FAILURE: Status {response.getcode()}")
    except urllib.error.HTTPError as e:
        print(f"   FAILURE: {e.code} - {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"   Error: {e}")

    # 4. Fetch /transactions (Verify Fix)
    print("4. Fetching /transactions...")
    req = urllib.request.Request(f"{BASE_URL}/transactions", headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as response:
            if response.getcode() == 200:
                txs = json.loads(response.read().decode('utf-8'))
                print(f"   SUCCESS: Fetched {len(txs)} transactions.")
            else:
                print(f"   FAILURE: Status {response.getcode()}")
    except urllib.error.HTTPError as e:
        print(f"   FAILURE: {e.code} - {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    asyncio.run(verify_fix())
