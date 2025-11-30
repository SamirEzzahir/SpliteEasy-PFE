import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://127.0.0.1:8000"
USERNAME = "debug_user_settle_v2"
PASSWORD = "password123"

def request(method, url, data=None, headers=None):
    if headers is None:
        headers = {}
    
    if data:
        data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, response.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')
    except Exception as e:
        return 0, str(e)

def main():
    print(f"Authenticating as {USERNAME}...")
    
    # Register
    status, body = request("POST", f"{BASE_URL}/auth/register", {
        "username": USERNAME, "email": f"{USERNAME}@example.com", "password": PASSWORD, "confirm_password": PASSWORD
    })
    if status not in [200, 201, 400]:
        print(f"Register failed: {body}")
        return

    # Login
    status, body = request("POST", f"{BASE_URL}/auth/login", None, {
        "Content-Type": "application/x-www-form-urlencoded"
    })
    # urllib doesn't handle data=dict for x-www-form-urlencoded automatically like requests
    # We need to encode it manually
    login_data = urllib.parse.urlencode({"username": USERNAME, "password": PASSWORD}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/auth/login", data=login_data, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode('utf-8')
            data = json.loads(body)
            token = data["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            print("Authenticated.")
    except Exception as e:
        print(f"Login failed: {e}")
        return

    # Create Group
    print("Creating group...")
    status, body = request("POST", f"{BASE_URL}/groups/", {"title": "Debug Group", "currency": "MAD"}, headers)
    if status not in [200, 201]:
        print(f"Create group failed: {body}")
        return
    group = json.loads(body)
    group_id = group["id"]
    print(f"Group created: ID {group_id}")

    # Test History
    print(f"Testing /settle/{group_id}/history...")
    status, body = request("GET", f"{BASE_URL}/settle/{group_id}/history", None, headers)
    print(f"History Status: {status}")
    if status == 500:
        print("Got 500 Error on History!")
        print(body) # Should contain the traceback now
    else:
        print(body)

    # Test Settlements
    print(f"Testing /settle/{group_id}/settlements...")
    status, body = request("GET", f"{BASE_URL}/settle/{group_id}/settlements", None, headers)
    print(f"Settlements Status: {status}")
    if status == 500:
        print("Got 500 Error on Settlements!")
        print(body)
    else:
        print(body)

if __name__ == "__main__":
    main()
