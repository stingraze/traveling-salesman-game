"""
TSP Game — Flask Backend
Run:  pip install -r requirements.txt && python app.py
Open: http://localhost:5000
"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json, uuid, time, os, math
from threading import Lock

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

DB_FILE  = os.path.join(os.path.dirname(__file__), "db.json")
db_lock  = Lock()

# ── JSON Database ────────────────────────────────────────────
def _empty_db():
    return {"games": [], "runs": []}

def load_db():
    if not os.path.exists(DB_FILE):
        return _empty_db()
    with open(DB_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except (json.JSONDecodeError, ValueError):
            return _empty_db()

def save_db(db):
    tmp = DB_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DB_FILE)

def with_db(mutator):
    with db_lock:
        db = load_db()
        result = mutator(db)
        save_db(db)
        return result

def read_db():
    with db_lock:
        return load_db()

# ── Helpers ──────────────────────────────────────────────────
now_ms = lambda: int(time.time() * 1000)
new_id = lambda: str(uuid.uuid4())

def euclidean(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])

def validate_distance(cities_map, route):
    d = 0.0
    for i in range(1, len(route)):
        a, b = cities_map.get(route[i-1]), cities_map.get(route[i])
        if a is None or b is None:
            return None
        d += euclidean(a, b)
    return round(d, 4)

# ── Serve Frontend ───────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

# ── Health ───────────────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify(status="ok")

# ── Games CRUD ───────────────────────────────────────────────
@app.route("/api/games", methods=["POST"])
def create_game():
    p = request.get_json(force=True)
    cities = p.get("cities")
    if not cities or len(cities) < 3:
        return jsonify(error="Need at least 3 cities"), 400
    game = {
        "id":         new_id(),
        "name":       (p.get("name") or "Untitled").strip(),
        "cities":     cities,
        "meta":       p.get("meta") or {},
        "created_at": now_ms(),
    }
    def mut(db):
        db["games"].append(game)
    with_db(mut)
    return jsonify(game), 201

@app.route("/api/games")
def list_games():
    db = read_db()
    try:
        limit  = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        return jsonify(error="limit/offset must be int"), 400
    items = db["games"][offset:offset+limit]
    return jsonify(total=len(db["games"]), items=items)

@app.route("/api/games/<game_id>")
def get_game(game_id):
    db = read_db()
    for g in db["games"]:
        if g["id"] == game_id:
            return jsonify(g)
    return jsonify(error="not found"), 404

# ── Runs (solutions) ────────────────────────────────────────
@app.route("/api/runs", methods=["POST"])
def submit_run():
    p = request.get_json(force=True)
    required = ("game_id", "player_name", "agent_type", "distance", "route")
    missing = [k for k in required if k not in p]
    if missing:
        return jsonify(error="missing fields", fields=missing), 400

    game_id = p["game_id"]
    db = read_db()
    game = next((g for g in db["games"] if g["id"] == game_id), None)
    if game is None:
        return jsonify(error="game_id not found"), 404

    cities_map = {c["id"]: c for c in game["cities"]}
    verified = validate_distance(cities_map, p["route"])

    run = {
        "id":              new_id(),
        "game_id":         game_id,
        "player_name":     str(p["player_name"]).strip(),
        "agent_type":      str(p["agent_type"]).strip(),
        "distance":        verified if verified is not None else float(p["distance"]),
        "verified":        verified is not None,
        "route":           p["route"],
        "num_cities":      len(game["cities"]),
        "compute_time_ms": int(p.get("compute_time_ms") or 0),
        "created_at":      now_ms(),
    }
    def mut(db2):
        db2["runs"].append(run)
    with_db(mut)
    return jsonify(run), 201

@app.route("/api/runs")
def list_runs():
    db = read_db()
    runs = db["runs"]
    gid = request.args.get("game_id")
    agt = request.args.get("agent_type")
    if gid:
        runs = [r for r in runs if r["game_id"] == gid]
    if agt:
        runs = [r for r in runs if r["agent_type"] == agt]
    return jsonify(total=len(runs), items=runs)

# ── High Scores ──────────────────────────────────────────────
@app.route("/api/highscores")
def highscores():
    """
    Returns scores sorted by:
      1) num_cities DESCENDING  (more cities = harder = ranked first)
      2) distance   ASCENDING   (shorter route = better)
    Each run includes num_cities so the frontend can display it.
    """
    scope = request.args.get("scope", "global")
    agt   = request.args.get("agent_type")
    try:
        limit = int(request.args.get("limit", 20))
    except ValueError:
        return jsonify(error="limit must be int"), 400

    db   = read_db()
    runs = db["runs"]

    # build lookup: game_id -> city count
    city_counts = {g["id"]: len(g.get("cities", [])) for g in db["games"]}

    # enrich every run with num_cities (backfill for older runs)
    enriched = []
    for r in runs:
        rc = dict(r)
        rc["num_cities"] = rc.get("num_cities") or city_counts.get(r["game_id"], 0)
        enriched.append(rc)

    if agt:
        enriched = [r for r in enriched if r["agent_type"] == agt]
    if not enriched:
        return jsonify(items=[])

    if scope == "per_game":
        best = {}
        for r in enriched:
            cur = best.get(r["game_id"])
            if cur is None or r["distance"] < cur["distance"]:
                best[r["game_id"]] = r
        items = list(best.values())
    else:
        items = enriched

    # PRIMARY: more cities first · SECONDARY: shorter distance first
    items.sort(key=lambda r: (-r["num_cities"], r["distance"]))
    items = items[:limit]

    return jsonify(items=items)

# ── Export ───────────────────────────────────────────────────
@app.route("/api/export/json")
def export_json():
    return jsonify(read_db())

# ── Run ──────────────────────────────────────────────────────
if __name__ == "__main__":
    if not os.path.exists(DB_FILE):
        save_db(_empty_db())
    print("✅  TSP Game running → http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
