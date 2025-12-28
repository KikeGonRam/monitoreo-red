import os
import json
from pathlib import Path
from datetime import datetime

try:
    from pymongo import MongoClient
    MONGO_AVAILABLE = True
except Exception:
    MONGO_AVAILABLE = False

DB_FILE = Path(__file__).resolve().parents[3] / 'datos' / 'monitors.json'
DB_FILE.parent.mkdir(parents=True, exist_ok=True)

class DBClient:
    def __init__(self, mongo_uri=None, db_name='mi_monitor_red'):
        self.mongo_uri = mongo_uri or os.getenv('MONGO_URI')
        self.db_name = db_name
        self.client = None
        self.col = None
        if self.mongo_uri and MONGO_AVAILABLE:
            try:
                self.client = MongoClient(self.mongo_uri, serverSelectionTimeoutMS=2000)
                self.col = self.client[self.db_name]['results']
                # Force a connection check
                self.client.server_info()
            except Exception:
                self.client = None
                self.col = None

    def insert_result(self, result: dict):
        result = dict(result)
        result.setdefault('timestamp', datetime.utcnow().isoformat())
        if self.col:
            self.col.insert_one(result)
        else:
            data = self._read_file()
            data.append(result)
            self._write_file(data)

    def get_recent(self, limit=50):
        if self.col:
            docs = list(self.col.find().sort('timestamp', -1).limit(limit))
            for d in docs:
                d['_id'] = str(d.get('_id'))
            return docs
        else:
            data = self._read_file()
            return list(reversed(data))[-limit:]

    def _read_file(self):
        if not DB_FILE.exists():
            return []
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []

    def _write_file(self, data):
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)


# Helper simple client factory
def get_db():
    return DBClient()
