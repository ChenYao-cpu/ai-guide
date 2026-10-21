"""Editorial content for curated routes; distances remain owned by the walking graph."""
import json
from functools import lru_cache
from pathlib import Path

PROFILE_PATH = Path(__file__).resolve().parents[3] / 'data/summer_palace_recommended_routes.json'


@lru_cache(maxsize=1)
def route_profiles():
    return json.loads(PROFILE_PATH.read_text(encoding='utf-8'))


def route_editorial(name, spots, overview):
    names = [spot['spot_name'] for spot in spots]
    # An operator can edit a saved route. Never attach stale curated content
    # merely because its display name still matches a preset.
    profile = next((p for p in route_profiles() if p['name'] == name
        and [s[0] for s in p['stops']] == names
        and all(s.get('city') in ('北京', '北京市', 'Beijing') for s in spots)), None)
    content = {}
    if profile:
        content = {
            'zh': dict(summary=profile['summary'], audience=profile['audience'],
                       highlights=profile['highlights'], tips=profile['tips']),
            'en': dict(summary=profile['summary_en'], audience=profile['audience_en'],
                       highlights=profile['highlights_en'], tips=profile['tips_en']),
        }
    stops = [dict(spot_id=spot['spot_id'], spot_name=spot['spot_name'], order=index+1,
                  visit_minutes=overview['stops'][index]['visit_minutes'],
                  focus={'zh': profile['stops'][index][1], 'en': profile['stops'][index][2]}
                        if profile else {'zh': spot.get('description') or '', 'en': ''})
             for index, spot in enumerate(spots)]
    legs = [{key: leg[key] for key in ('from_id', 'to_id', 'meters', 'minutes', 'available', 'has_steps')}
            for leg in overview['legs']]
    return dict(editorial=content, itinerary_stops=stops, walking_legs=legs,
                hero_spot_name=profile.get('cover_spot', names[0] if names else '') if profile else (names[0] if names else ''),
                rest_time_minutes=overview['rest_minutes'], complete=overview['complete'],
                has_steps=any(leg['has_steps'] for leg in overview['legs']),
                distance_version=overview['distance_version'],
                editorial_sources=profile['sources'] if profile else [])
