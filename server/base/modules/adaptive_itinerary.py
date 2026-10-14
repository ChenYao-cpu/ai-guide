"""Repair the unvisited suffix of a tour using measured-map walking distances.

Distances are the project's OSM snapshot, not live walking instructions. The
planner preserves order and completed stops, and never certifies accessibility.
"""
import hashlib
import json
import math
import re

from .route_recommender import _distance, _features, get_spot_profile, normalize_preferences


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).encode()).hexdigest()


def parse_change(text):
    """Conservative bilingual intent parsing; numeric limits are never invented."""
    q = text.lower().strip().replace('个小时', '小时')
    active = bool(re.search(r'只剩|还剩|剩下|提前离园|早点离园|回出口|调整路线|改.*路线|少走|走不动|累了|跳过|不去|不想去|不想爬|避开|minutes? left|hours? left|tired|skip|replan|leave early|less walking|avoid stairs', q))
    if re.search(r'不(?:需要|用|要)调整|不用改|不累|not tired|do not replan', q):
        active = False
    minutes = None
    number = r'(\d+(?:\.\d+)?|半|[一二两三四五六七八九十]+)'
    match = re.search(number + r'\s*(分钟|小时|minutes?|mins?|hours?|hrs?)', q)
    if match:
        raw, unit = match.groups()
        digits = dict(zip('一二两三四五六七八九', [1, 2, 2, 3, 4, 5, 6, 7, 8, 9]))
        if raw == '半': value = .5
        elif '十' in raw:
            a, b = raw.split('十'); value = digits.get(a, 1) * 10 + digits.get(b, 0)
        elif raw in digits: value = digits[raw]
        else: value = float(raw)
        minutes = round(value * (60 if unit.startswith(('h', '小时')) else 1))
    if match and match.group(2).startswith(('h', '小时')) and q[match.end():].lstrip().startswith('半'): minutes += 30
    if re.search(r'半小时|half an? hour', q): minutes = 30
    return {'active': active, 'remaining_minutes': minutes,
            'pace': 'relaxed' if re.search(r'累了|走不动|少走|不想爬|避开.*台阶|tired|less walking|avoid stairs', q) else None,
            'exit_area': next((area for pattern, area in [(r'北宫门|北门|north', 'north'),
                (r'东宫门|东门|east', 'east'), (r'南门|南侧|south', 'south')] if re.search(pattern, q)), None),
            'skip_next': bool(re.search(r'下一站.*(?:不想去|不去|跳过)|跳过下一站|skip (?:the next|next) stop', q)) and not bool(re.search(r'不要跳过|不用跳过|do not skip|don.t skip', q))}


def repair_route(route, index, catalog, minutes, pace='standard', end_area='auto', excluded=None, preferences=None, reserve=0):
    if not route or not 0 <= index < len(route): raise ValueError('路线进度不可用')
    if len(route) > 20: raise ValueError('路线最多支持20站，请先精简行程')
    if not 1 <= minutes <= 480: raise ValueError('剩余时间须为1至480分钟')
    if len({s['spot_id'] for s in route}) != len(route): raise ValueError('路线中有重复景点，请重新规划')
    anchor = route[index]
    if not get_spot_profile(anchor): raise ValueError('当前景点缺少已核对步行路网，暂不能自动调整')
    end_name = {'east': '仁寿殿', 'north': '苏州街', 'south': '铜牛'}.get(end_area)
    destination = next((s for s in catalog if s['spot_name'] == end_name and get_spot_profile(s)), None)
    if end_name and not destination: raise ValueError('离园区域数据不可用')
    excluded = set(excluded or [])
    suffix = route[index + 1:]
    unavailable = [s for s in suffix if not get_spot_profile(s)]
    if unavailable: raise ValueError('剩余路线中有景点缺少已核对步行路网')
    eligible = [s for s in suffix if s['spot_id'] not in excluded and not (pace == 'relaxed' and _features(s)['stairs'])]
    speed = 55 if pace == 'relaxed' else 75

    def cost(stops):
        sequence = [anchor] + stops
        legs = [_distance(a, b) for a, b in zip(sequence, sequence[1:])]
        exit_m = _distance(sequence[-1], destination) if destination else 0
        walking = sum(math.ceil(m / speed) for m in legs)
        exit_time = math.ceil(exit_m / speed) + 5 if destination else 0
        visiting = sum(max(1, int(s.get('visit_duration') or 20)) for s in stops)
        resting = math.ceil((walking + visiting + exit_time) * (.15 if pace == 'relaxed' else .08))
        return dict(visit_minutes=visiting, walk_minutes=walking, rest_minutes=resting,
                    exit_minutes=exit_time, reserve_minutes=reserve,
                    total_minutes=visiting + walking + resting + exit_time + reserve,
                    walking_meters=round(sum(legs) + exit_m))

    prefs = normalize_preferences(preferences or [])
    def value(s):
        affinity = _features(s)['affinities']
        return sum(affinity.get(p, 0) for p in (list(affinity) if prefs == ['comprehensive'] else prefs))

    # At most 19 remaining stops. Enumerate order-preserving subsets: no
    # backtracking and no surprise new attractions. Cap combinations for large
    # itineraries using a deterministic beam; identify that method in metadata.
    beam = [([], cost([]), 0)]
    for spot in eligible:
        extended = []
        for stops, _, score in beam:
            trial = stops + [spot]; c = cost(trial)
            if c['total_minutes'] <= minutes:
                extended.append((trial, c, score + value(spot)))
        beam += extended
        beam = sorted(beam, key=lambda x: (-x[2], -len(x[0]), x[1]['total_minutes'], tuple(s['spot_id'] for s in x[0])))[:4096]
    valid = [x for x in beam if x[1]['total_minutes'] <= minutes]
    if valid:
        kept, totals, _ = max(valid, key=lambda x: (x[2], len(x[0]), -x[1]['total_minutes']))
    else:
        kept, totals = [], cost([])
    chosen = {s['spot_id'] for s in kept}
    removed = []
    for s in suffix:
        if s['spot_id'] in chosen: continue
        reason = 'visitor' if s['spot_id'] in excluded else 'stairs' if pace == 'relaxed' and _features(s)['stairs'] else 'budget'
        removed.append(dict(spot_id=s['spot_id'], spot_name=s['spot_name'], reason=reason))
    return dict(current_spot=anchor['spot_name'], current_spot_id=anchor['spot_id'],
        completed_ids=[s['spot_id'] for s in route[:index]],
        spot_ids=[s['spot_id'] for s in route[:index + 1] + kept],
        next_spots=[dict(spot_id=s['spot_id'], spot_name=s['spot_name']) for s in kept],
        removed=removed, totals=totals, original_totals=cost(suffix),
        remaining_minutes=minutes, feasible=bool(valid), pace=pace, end_area=end_area,
        end_anchor=end_name or '', exit_only=not kept,
        algorithm='order-preserving-subset-beam-v1', distance_version='OSM-2026-10-10',
        note='从当前站离开时起估算；含步行、后续停留、休息和预留。出口使用附近锚点加5分钟，非实时导航或无障碍保证。')
