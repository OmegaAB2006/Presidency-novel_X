import os
import redis

REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
REDIS_AVAILABLE = False

def _make_client():
    global REDIS_AVAILABLE
    try:
        client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        client.ping()
        REDIS_AVAILABLE = True
        print("Redis: connected.")
        return client
    except Exception:
        REDIS_AVAILABLE = False
        print("Redis: not available, using in-memory fallback (fakeredis).")
        import fakeredis
        return fakeredis.FakeRedis(decode_responses=True)

r = _make_client()
