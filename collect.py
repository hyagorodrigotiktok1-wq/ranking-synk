#!/usr/bin/env python3
"""
Coleta dados de Instagram dos candidatos ao Senado de Sergipe.
Requer: IG_SESSION_ID como variável de ambiente (cookie sessionid do Instagram logado).
Gera: data/latest.json com dados dos últimos 7 dias.
"""
import os, json, time, datetime, requests

SESSION_ID = os.environ["IG_SESSION_ID"]
HEADERS = {
    "X-IG-App-ID": "936619743392459",
    "X-Requested-With": "XMLHttpRequest",
    "Cookie": f"sessionid={SESSION_ID}",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
}

with open("candidates.json", encoding="utf-8") as f:
    CANDIDATES = json.load(f)

# Janela: últimos 7 dias em BRT (UTC-3)
brt = datetime.timezone(datetime.timedelta(hours=-3))
now = datetime.datetime.now(brt)
end_dt = now
start_dt = now - datetime.timedelta(days=7)
START_TS = int(start_dt.timestamp())
END_TS = int(end_dt.timestamp())
BUFFER = 7 * 24 * 3600  # 7 dias de buffer de paginação


def collect_user(candidate):
    user_id = candidate["userId"]
    handle = candidate["handle"]
    all_items = []
    cursor = None
    page = 0

    while page < 30:
        url = (
            f"https://www.instagram.com/api/v1/feed/user/{user_id}/?count=50"
            + (f"&max_id={cursor}" if cursor else "")
        )
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
        except Exception as e:
            print(f"  [{handle}] erro de rede: {e}")
            break

        if resp.status_code == 429:
            print(f"  [{handle}] rate limit, aguardando 90s...")
            time.sleep(90)
            continue
        if resp.status_code in (401, 403):
            print(f"  [{handle}] autenticacao negada HTTP {resp.status_code} - sessao invalida ou bloqueada")
            break
        if not resp.ok:
            print(f"  [{handle}] HTTP {resp.status_code}")
            break

        data = resp.json()
        items = data.get("items", [])
        if not items:
            break

        all_items.extend(items)
        oldest = items[-1]["taken_at"]

        if not data.get("more_available") or oldest < START_TS - BUFFER:
            break

        cursor = data.get("next_max_id")
        page += 1
        time.sleep(1.5)  # gentil com a API

    in_range = [i for i in all_items if START_TS <= i["taken_at"] <= END_TS]

    views = 0
    likes = 0
    comments = 0
    posts = len(in_range)
    reels = 0
    photos = 0
    carousels = 0

    for item in in_range:
        mt = item.get("media_type", 1)
        if mt == 2:
            reels += 1
            views += item.get("play_count", item.get("view_count", 0))
        elif mt == 8:
            carousels += 1
            views += item.get("view_count", 0)
        else:
            photos += 1
            views += item.get("view_count", 0)
        likes += item.get("like_count", 0)
        comments += item.get("comment_count", 0)

    interactions = likes + comments
    followers = candidate.get("followers", 1)
    engagement = round(interactions / max(posts, 1) / followers * 100, 2) if followers else 0

    return {
        "handle": handle,
        "name": candidate["name"],
        "party": candidate["party"],
        "followers": followers,
        "highlight": candidate.get("highlight", False),
        "period": {
            "start": start_dt.strftime("%Y-%m-%d"),
            "end": end_dt.strftime("%Y-%m-%d"),
        },
        "stats": {
            "posts": posts,
            "reels": reels,
            "photos": photos,
            "carousels": carousels,
            "views": views,
            "likes": likes,
            "comments": comments,
            "interactions": interactions,
            "engagement_rate": engagement,
            "avg_views_per_post": round(views / posts) if posts else 0,
            "avg_interactions_per_post": round(interactions / posts) if posts else 0,
        },
    }


results = []
for i, cand in enumerate(CANDIDATES):
    print(f"Coletando @{cand['handle']}...")
    result = collect_user(cand)
    results.append(result)
    print(f"  → {result['stats']['posts']} posts, {result['stats']['views']:,} views")
    if i < len(CANDIDATES) - 1:
        print("  aguardando 8s...")
        time.sleep(8)

output = {
    "updated_at": now.strftime("%Y-%m-%dT%H:%M:%S-03:00"),
    "updated_at_display": now.strftime("%d/%m/%Y às %H:%M (BRT)"),
    "candidates": results,
}

os.makedirs("data", exist_ok=True)
with open("data/latest.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\n✅ Salvo em data/latest.json ({len(results)} candidatos)")
