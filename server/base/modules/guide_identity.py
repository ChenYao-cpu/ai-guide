"""数字导游声线规则。"""

SHOWCASE_GUIDE_NAME = "小颐"
SHOWCASE_GUIDE_CHARACTER = "博学、亲切，擅长把颐和园历史文化讲成生动故事"


def resolve_guide_voice(voice_style: str) -> str:
    """返回管理员显式配置的备用声线；未配置时给出女性默认值。"""
    return voice_style or "female_wenrou"
