"""City constraints grounded in saved city fields or explicit street addresses."""
import re


def normalize_city(city):
    return str(city or '').strip().removesuffix('市')


def spot_city(spot):
    value=lambda key:getattr(spot,key,spot.get(key,'') if isinstance(spot,dict) else '')
    city=normalize_city(value('city'))
    if city:return city
    address=str(value('location') or '')
    for municipality in ('北京','上海','天津','重庆'):
        if address.startswith(municipality+'市'):return municipality
    address=re.split(r'省|自治区',address)[-1]
    match=re.match(r'([\u4e00-\u9fff]{2,7}?)市',address)
    return normalize_city(match.group(1)) if match else ''


def route_city(spots):
    cities={spot_city(spot) for spot in spots}
    if not spots:raise ValueError('路线至少需要一个景点')
    if '' in cities:raise ValueError('请先为路线景点配置所属城市')
    if len(cities)!=1:raise ValueError('一条路线只能包含同一城市的景点')
    return cities.pop()
