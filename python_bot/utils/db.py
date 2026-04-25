import json
import os

DB_FILE = "database.json"

DEFAULT_DB = {
    "admin_password": "Fotixbek1!",
    "channels": [],
    "websites": [],
    "keywords": [],
    "schedules": [],
    "openai_token": None,
    "message_prompt": None
}

class Database:
    def __init__(self):
        if not os.path.exists(DB_FILE):
            self.save(DEFAULT_DB)
    
    def load(self):
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return DEFAULT_DB

    def save(self, data):
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

    def get(self, key, default=None):
        data = self.load()
        return data.get(key, default)

    def set(self, key, value):
        data = self.load()
        data[key] = value
        self.save(data)

    def delete(self, key):
        data = self.load()
        if key in data:
            del data[key]
            self.save(data)

db = Database()
