# TSP Game

A Traveling Salesman Problem game where humans compete against bots.
Flask backend with a JSON file database; vanilla JS frontend.

![Traveling Salesman Game Screenshot](https://github.com/stingraze/traveling-salesman-game/blob/main/traveling-salesman-game-screenshot.jpg)

(C)Tsubasa Kato - Inspire Search Corp. & Curioforce Corp. - 2026/2/6 18:27PM - Created with the help of Perplexity Max.

## Quick Start

```bash
pip install -r requirements.txt
python app.py
```

Open **http://localhost:5000** in your browser — that's it!

## High Score Sorting

Scores are ranked by:
1. **Number of cities** — descending (more cities = harder = ranked higher)
2. **Distance** — ascending (shorter route wins within the same city count)

The Cities column is visible in the leaderboard table.

## API Endpoints

| Method | Path                 | Description                         |
|--------|----------------------|-------------------------------------|
| GET    | `/api/health`        | Health check                        |
| POST   | `/api/games`         | Create a game (body: name, cities)  |
| GET    | `/api/games`         | List games (?limit, ?offset)        |
| GET    | `/api/games/<id>`    | Get one game                        |
| POST   | `/api/runs`          | Submit a solution                   |
| GET    | `/api/runs`          | List runs (?game_id, ?agent_type)   |
| GET    | `/api/highscores`    | Leaderboard (?scope, ?agent_type)   |
| GET    | `/api/export/json`   | Export entire database              |

## Project Structure

```
tsp_project/
├── app.py
├── requirements.txt
├── db.json             ← auto-created
├── README.md
└── static/
    ├── index.html
    ├── style.css
    └── app.js
```
