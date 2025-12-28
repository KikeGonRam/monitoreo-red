import socket
from datetime import datetime
from pymongo import MongoClient

# Conectar a MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['mi_red']

# Información básica
info = {
    'host': socket.gethostname(),
    'ip': socket.gethostbyname(socket.gethostname()),
    'timestamp': datetime.now(),
    'proyecto': 'Mi Monitor de Red'
}

# Guardar
db.dispositivos.insert_one(info)

print(f"✅ Guardado en MongoDB")
print(f"   Base de datos: mi_red")
print(f"   Colección: dispositivos")
print(f"   Para ver: mongosh -> use mi_red -> db.dispositivos.find()")
