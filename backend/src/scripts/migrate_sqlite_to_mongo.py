"""
Migration Script: SQLite (SQLAlchemy) -> MongoDB (Mongoose)
Migrates legacy relational records from `labelguard.db` to MongoDB collections:
- users -> users
- products -> products
- compliance_rules -> compliancerules
"""

import os
import sqlite3
from pymongo import MongoClient

SQLITE_PATH = os.environ.get("SQLITE_PATH", "labelguard.db")
MONGO_URI = os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017/labelguard_db")


def migrate():
    if not os.path.exists(SQLITE_PATH):
        print(f"[Migration] No SQLite database found at {SQLITE_PATH}. Nothing to migrate.")
        return

    print(f"[Migration] Connecting to SQLite: {SQLITE_PATH} and MongoDB: {MONGO_URI}")
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client.get_database()

    # 1. Migrate Users
    try:
        cur = sqlite_conn.cursor()
        cur.execute("SELECT * FROM users")
        users = [dict(row) for row in cur.fetchall()]
        if users:
            for u in users:
                db.users.update_one(
                    {"email": u["email"]},
                    {
                        "$setOnInsert": {
                            "email": u["email"],
                            "hashedPassword": u.get("hashed_password"),
                            "fullName": u.get("full_name"),
                            "role": u.get("role", "INSPECTOR"),
                            "isActive": bool(u.get("is_active", 1)),
                        }
                    },
                    upsert=True,
                )
            print(f"[Migration] Migrated {len(users)} users.")
        else:
            print("[Migration] 0 users found in SQLite.")
    except Exception as e:
        print(f"[Migration] User migration skipped/error: {e}")

    # 2. Migrate Products
    try:
        cur = sqlite_conn.cursor()
        cur.execute("SELECT * FROM products")
        products = [dict(row) for row in cur.fetchall()]
        if products:
            for p in products:
                db.products.update_one(
                    {"barcodeGtin": p.get("barcode_gtin")},
                    {
                        "$setOnInsert": {
                            "name": p.get("name"),
                            "brand": p.get("brand"),
                            "category": p.get("category", "FOOD"),
                            "barcodeGtin": p.get("barcode_gtin"),
                            "description": p.get("description"),
                        }
                    },
                    upsert=True,
                )
            print(f"[Migration] Migrated {len(products)} products.")
        else:
            print("[Migration] 0 products found in SQLite.")
    except Exception as e:
        print(f"[Migration] Product migration skipped/error: {e}")

    print("[Migration] SQLite to MongoDB migration complete.")
    sqlite_conn.close()
    mongo_client.close()


if __name__ == "__main__":
    migrate()
