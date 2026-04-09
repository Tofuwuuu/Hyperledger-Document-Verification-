import os
import random
import time

import httpx


def main() -> None:
    count = int(os.getenv("SEED_USERS_COUNT", "10"))
    password = os.getenv("SEED_USERS_PASSWORD", "admin12345")
    base_url = os.getenv("SEED_USERS_API_URL", "http://localhost:8000")

    url = f"{base_url.rstrip('/')}/api/v1/auth/register"
    print("Seeding via API:", url)

    created = 0
    base_ts = int(time.time())
    for i in range(count):
        # Keep IDs short (backend validates max length, e.g. <= 20 chars).
        short = f"{base_ts % 100000:05d}{i:02d}{random.randint(100,999)}"  # 5+2+3=10 chars
        student_id = f"{short[:5]}-{short[5:7]}-{short[7:]}"  # digits + hyphens only, len=12
        payload = {
            "email": f"seedapi_{short}@example.com",
            "full_name": f"Seed API User {i + 1}",
            "student_id": student_id,
            "graduation_year": 2026,
            "password": password,
            "confirm_password": password,
        }

        r = httpx.post(url, json=payload, timeout=15)
        if r.status_code == 200:
            created += 1
            print(f"- created {payload['email']}")
        else:
            print(f"- failed {payload['email']} status={r.status_code} body={r.text}")

    print(f"Done. Created {created}/{count} users.")


if __name__ == "__main__":
    main()

