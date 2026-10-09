"""数字导游模型与声线的一致性规则。"""

SHOWCASE_GUIDE_NAME = "小颐"
SHOWCASE_GUIDE_CHARACTER = "博学、亲切，擅长把颐和园历史文化讲成生动故事"
FEMALE_DEFAULT_MODEL = "/models/西装女.vrm"
MALE_DEFAULT_MODEL = "/models/西装男导游1.vrm"


def voice_gender(voice_style: str) -> str:
    if (voice_style or "").startswith("male_"):
        return "male"
    return "female"


def model_gender(model_path: str) -> str:
    value = (model_path or "").lower()
    if "女" in value or "female" in value:
        return "female"
    if "男" in value or "male" in value:
        return "male"
    return "unknown"


def validate_guide_identity(voice_style: str, model_path: str) -> tuple[bool, str]:
    gender = model_gender(model_path)
    if gender != "unknown" and gender != voice_gender(voice_style):
        return False, "数字人模型与声线性别不一致，请重新选择"
    return True, ""


def resolve_model_path(voice_style: str, model_path: str) -> str:
    """缺少模型时按声线补齐；已有模型作为人物身份的运行时依据。"""
    if model_path:
        return model_path
    return MALE_DEFAULT_MODEL if voice_gender(voice_style) == "male" else FEMALE_DEFAULT_MODEL


def resolve_voice_style(voice_style: str, model_path: str) -> str:
    """运行时兜底，确保模型外观与 TTS 声线不会串用。"""
    gender = model_gender(model_path)
    if gender == "male" and voice_gender(voice_style) != "male":
        return "male_wenhou"
    if gender == "female" and voice_gender(voice_style) != "female":
        return "female_wenrou"
    return voice_style or ("male_wenhou" if gender == "male" else "female_wenrou")
