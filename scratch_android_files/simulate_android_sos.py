import requests
import json
import uuid
import os

BASE_URL = 'http://localhost:3000'

# 1. Register a user
print("1. Registering user...")
email = f"test_{uuid.uuid4().hex[:8]}@example.com"
password = "password123"
resp = requests.post(f"{BASE_URL}/auth/register", json={
    "email": email,
    "password": password,
    "fullName": "Test User",
    "phone": f"+84999{uuid.uuid4().hex[:6]}"
})
if resp.status_code not in (200, 201):
    print("Register failed:", resp.text)
    exit(1)
token = resp.json().get('data', {}).get('accessToken')
if not token:
    print("No token returned")
    exit(1)

headers = {"Authorization": f"Bearer {token}"}

# 2. Get upload URL
print("2. Requesting upload URL...")
resp = requests.post(f"{BASE_URL}/sos/photo/upload-url", json={"contentType": "image/jpeg"}, headers=headers)
if resp.status_code != 201:
    print("Get upload URL failed:", resp.text)
    exit(1)
data = resp.json()['data']
upload_url = data['uploadUrl']
object_key = data['objectKey']
print("OBJECT_KEY_RETURNED: YES", object_key)

# 3. PUT to R2
print("3. Uploading to R2...")
dummy_image = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00\x43\x00\xff\xd9"
resp = requests.put(upload_url, data=dummy_image, headers={"Content-Type": "image/jpeg"})
if resp.status_code != 200:
    print("R2 PUT failed:", resp.status_code, resp.text)
    exit(1)
print("R2_PUT: PASS")

# 4. POST SOS
print("4. Creating SOS...")
sos_data = {
    "adults": 1,
    "children": 0,
    "elderly": 0,
    "neededItems": ["Nước uống"],
    "condition": "Mất liên lạc",
    "latitude": 10.0,
    "longitude": 106.0,
    "photoUrl": object_key
}
resp = requests.post(f"{BASE_URL}/sos", json=sos_data, headers=headers)
if resp.status_code != 201:
    print("Create SOS failed:", resp.text)
    exit(1)
event_id = resp.json()['data']['eventId']
print("CREATE_SOS: PASS")

# 5. Database verify
print("5. Verifying DB... skipped due to missing psycopg2")

# 6. GET SOS
print("6. Fetching SOS...")
resp = requests.get(f"{BASE_URL}/sos/{event_id}", headers=headers)
if resp.status_code != 200:
    print("Fetch SOS failed:", resp.text)
    exit(1)
fetched_photo = resp.json()['data']['photoUrl']
print(f"PRESIGNED_GET: {'PASS' if fetched_photo.startswith('http') else 'FAIL'}")
if fetched_photo.startswith('http'):
    # 7. Download image
    print("7. Downloading image...")
    resp = requests.get(fetched_photo)
    print(f"IMAGE_HTTP_GET: {'PASS' if resp.status_code == 200 else 'FAIL'}")

print("ALL_TESTS_COMPLETED")
