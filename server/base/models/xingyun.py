"""每位导游独立绑定星云应用，凭据不放入公开导游模型。"""
from sqlmodel import Field, SQLModel


class XingyunGuideBinding(SQLModel, table=True):
    guide_id: int = Field(primary_key=True, foreign_key="digital_guide_info.guide_id")
    app_id: str
    secret_encrypted: str
    voice_label: str = ""

