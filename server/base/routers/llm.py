#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   llm.py
@Time    :   2024/09/02
@Project :   https://github.com/PeterH0323/Streamer-Sales
@Author  :   HinGwenWong
@Version :   1.0
@Desc    :   大模型接口
"""


from typing import Dict, List
import os
from fastapi import APIRouter, Depends
from loguru import logger

from ..database.llm_db import get_llm_product_prompt_base_info
from ..database.product_db import get_db_product_info
from ..database.streamer_info_db import get_db_streamer_info
from ..models.product_model import ProductInfo
from ..models.streamer_info_model import StreamerInfo
from ..server_info import SERVER_PLUGINS_INFO
from ..utils import LLM_MODEL_HANDLER, ResultCode, make_return_data
from .users import get_current_user_info

router = APIRouter(
    prefix="/llm",
    tags=["llm"],
    responses={404: {"description": "Not found"}},
)


def combine_history(prompt: list, history_msg: list):
    """生成对话历史 prompt

    Args:
        prompt (_type_): _description_
        history_msg (_type_): _description_. Defaults to None.

    Returns:
        _type_: _description_
    """
    # 角色映射表（支持导游角色）
    role_map = {"streamer": "assistant", "guide": "assistant", "user": "user"}

    # 生成历史对话信息
    for message in history_msg:
        prompt.append({"role": role_map[message["role"]], "content": message["message"]})

    return prompt


async def gen_guide_base_prompt(
    user_id: int,
    guide_id: int = -1,
    spot_id: int = -1,
    guide_info=None,
    spot_info=None,
    visitor_name: str = "",
) -> list:
    """生成景区导游讲解的 prompt

    Args:
        user_id: 用户 ID
        guide_id: 导游 ID
        spot_id: 景点 ID
        guide_info: 导游信息（DigitalGuideInfo），如果为空则根据 guide_id 查表
        spot_info: 景点信息（ScenicSpotInfo），如果为空则根据 spot_id 查表
        visitor_name: 游客昵称

    Returns:
        List[Dict[str,str]]: 生成的 prompt
    """
    from ..database.digital_guide_db import get_db_digital_guides
    from ..database.scenic_spot_db import get_db_scenic_spot_info

    # 导游系统提示词
    visitor_greeting = (
        f"当前服务的游客昵称是「{visitor_name}」。只在首次欢迎或确有必要时自然称呼一次，"
        "普通问答直接回答内容；禁止每条回复或每个段落固定用游客昵称、导游姓名开头。"
        if visitor_name
        else "禁止每条回复或每个段落固定用导游姓名开头。"
    )
    system_str = (
        "你是{guide_name}，一名专业的景区导游。你的说话风格是{character}。"
        "你精通本景区的历史文化、自然地理、建筑特色等各方面知识。"
        f"{visitor_greeting}"
        "请根据景点信息和知识库资料，为游客提供专业、准确、生动、有温度的导览讲解。"
        "你的回答应该：1) 准确有据（基于知识库资料）；2) 生动有趣（用自己的知识补充合理的细节，"
        "让讲解真实自然）；3) 热情友好（让游客感受到温暖）。"
        "★ 严禁出现【XX】格式的占位符，每个描述都要写具体。关键事实和数据须基于资料，"
        "未在资料中出现的雕刻纹样、典故和设施位置不要编造。"
        "先直接回答游客的问题，通常用2至4句、80至150字口语讲解；游客要求详细时再展开。"
        "缺少某项资料时说明具体缺少什么，并提供资料中可确认的相关信息，不要笼统拒绝所有问题。"
    )

    # 获取导游信息
    if guide_info is None:
        guides, _ = await get_db_digital_guides(user_id, guide_id=guide_id)
        if guides:
            guide_info = guides[0]
        else:
            # 使用默认导游信息
            guide_info = type("obj", (object,), {
                "name": "景区导游",
                "character": "博学、亲切、热情",
            })()

    character_str = guide_info.character.replace(";", "、")
    system_str = system_str.replace("{guide_name}", guide_info.name).replace("{character}", character_str)

    # 获取景点信息
    if spot_info is None and spot_id > 0:
        spots, _ = await get_db_scenic_spot_info(user_id, spot_id=spot_id)
        if spots:
            spot_info = spots[0]

    # 构建首轮引导语
    if spot_info is not None:
        spot_name = spot_info.spot_name
        spot_category = spot_info.category
        spot_desc = spot_info.description
        spot_tags = spot_info.tags.replace(";", "、")
        spot_location = spot_info.location
        spot_best_season = spot_info.best_season

        category_map = {
            "natural": "自然风光",
            "historical": "历史文化",
            "cultural": "人文景观",
            "modern": "现代建筑",
            "comprehensive": "综合景点",
        }
        category_cn = category_map.get(spot_category, spot_category)

        first_input = (
            f"你现在位于景区的{spot_location}，眼前就是著名的「{spot_name}」。"
            f"这是一处{category_cn}景点，特色标签包括：{spot_tags}。"
            f"最佳游览季节是{spot_best_season}。"
            f"景点简介：{spot_desc}"
            f"\n\n请作为导游，为游客介绍这个景点的历史文化、特色亮点和有趣的典故，"
            f"并邀请游客提问互动。"
        )
    else:
        first_input = (
            "欢迎游客来到景区！请热情地向游客介绍自己，"
            "询问游客的游览偏好（喜欢历史文化还是自然风光），"
            "并根据游客的偏好推荐合适的游览路线。"
        )

    prompt = [
        {"role": "system", "content": system_str},
        {"role": "user", "content": first_input},
    ]
    logger.info(f"Guide prompt: {prompt}")

    return prompt


async def gen_poduct_base_prompt(
    user_id: int,
    streamer_id: int = -1,
    product_id: int = -1,
    streamer_info: StreamerInfo | None = None,
    product_info: ProductInfo | None = None,
) -> List[Dict[str, str]]:
    """生成商品介绍的 prompt

    Args:
        user_id (int): 用户 ID
        streamer_id (int): 主播 ID
        product_id (int): 商品 ID
        streamer_info (StreamerInfo, optional): 主播信息，如果为空则根据 streamer_id 查表
        product_info (ProductInfo, optional): 商品信息，如果为空则根据 product_id 查表

    Returns:
        List[Dict[str,str]]: 生成的 promot
    """

    assert (streamer_id == -1 and streamer_info is not None) or (streamer_id != -1 and streamer_info is None)
    assert (product_id == -1 and product_info is not None) or (product_id != -1 and product_info is None)

    # 加载对话配置文件
    dataset_yaml = await get_llm_product_prompt_base_info()

    # 从配置中提取对话设置相关的信息
    # system_str: 系统词，针对销售角色定制
    # first_input_template: 对话开始时的第一个输入模板
    # product_info_struct_template: 产品信息结构模板
    system = dataset_yaml["conversation_setting"]["system"]
    first_input_template = dataset_yaml["conversation_setting"]["first_input"]
    product_info_struct_template = dataset_yaml["product_info_struct"]

    # 根据 ID 获取主播信息
    if streamer_info is None:
        streamer_info = await get_db_streamer_info(user_id, streamer_id)
        streamer_info = streamer_info[0]

    # 将销售角色名和角色信息插入到 system prompt
    character_str = streamer_info.character.replace(";", "、")
    system_str = system.replace("{role_type}", streamer_info.name).replace("{character}", character_str)

    # 根据 ID 获取商品信息
    if product_info is None:
        product_list, _ = await get_db_product_info(user_id, product_id=product_id)
        product_info = product_list[0]

    heighlights_str = product_info.heighlights.replace(";", "、")
    price_str = str(product_info.selling_price)  # 获取价格
    product_info_str = product_info_struct_template[0].replace("{name}", product_info.product_name)
    product_info_str += product_info_struct_template[1].replace("{highlights}", heighlights_str)
    product_info_str += f"，价格是{price_str}元"  # 增加价格信息

    # 生成商品文案 prompt
    sales_doc_prompt = first_input_template.replace("{product_info}", product_info_str)
    # heighlights_str = product_info.heighlights.replace(";", "、")
    # product_info_str = product_info_struct_template[0].replace("{name}", product_info.product_name)
    # product_info_str += product_info_struct_template[1].replace("{highlights}", heighlights_str)
    #
    # # 生成商品文案 prompt
    # sales_doc_prompt = first_input_template.replace("{product_info}", product_info_str)

    prompt = [{"role": "system", "content": system_str}, {"role": "user", "content": sales_doc_prompt}]
    logger.info(prompt)

    return prompt


async def get_agent_res(prompt, departure_place, delivery_company):
    """调用 Agent 能力"""
    agent_response = ""

    if not SERVER_PLUGINS_INFO.agent_enabled:
        # 如果不开启则直接返回空
        return ""

    # Agent 是可选能力，仅在启用后加载其额外依赖。
    from ..modules.agent.agent_worker import get_agent_result

    GENERATE_AGENT_TEMPLATE = (
        "这是网上获取到的信息：“{}”\n 客户的问题：“{}” \n 请认真阅读信息并运用你的性格进行解答。"  # Agent prompt 模板
    )
    input_prompt = prompt[-1]["content"]
    agent_response = get_agent_result(LLM_MODEL_HANDLER, input_prompt, departure_place, delivery_company)
    if agent_response != "":
        agent_response = GENERATE_AGENT_TEMPLATE.format(agent_response, input_prompt)
        logger.info(f"Agent response: {agent_response}")

    return agent_response


async def get_llm_res(prompt, json_mode: bool = False):
    """获取 LLM 推理返回

    Args:
        prompt (str): _description_

    Returns:
        _type_: _description_
    """
    logger.info(prompt)
    model_name = os.getenv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")

    import asyncio

    def _request():
        request_kwargs = dict(
            model=model_name,
            messages=prompt,
            stream=False,
            temperature=0.1 if json_mode else 0.35,
            # DeepSeek Flash 会把推理过程计入输出预算；预算过小时可能只
            # 返回 reasoning_content 而 content 为空。
            max_tokens=4096,
        )
        if json_mode:
            request_kwargs["response_format"] = {"type": "json_object"}
        try:
            return LLM_MODEL_HANDLER.chat.completions.create(**request_kwargs)
        except Exception:
            if not json_mode:
                raise
            logger.warning("当前模型不支持 JSON response_format，回退到提示词约束")
            request_kwargs.pop("response_format", None)
            return LLM_MODEL_HANDLER.chat.completions.create(**request_kwargs)

    # OpenAI SDK 是同步客户端，放入工作线程避免阻塞 FastAPI 事件循环。
    response = await asyncio.to_thread(_request)
    res_data = response.choices[0].message.content or ""
    if not res_data.strip():
        raise RuntimeError("模型未返回可展示内容")
    return res_data.strip()
    # logger.info(prompt)
    # model_name = LLM_MODEL_HANDLER.available_models[0]
    #
    # res_data = ""
    # for item in LLM_MODEL_HANDLER.chat_completions_v1(model=model_name, messages=prompt):
    #     print("LLM response item:", item)
    #     print("Type of item:", type(item))
    #     res_data = item["choices"][0]["message"]["content"]
    #
    # return res_data


@router.get("/gen_sales_doc", summary="生成主播文案接口")
async def get_product_info_api(streamer_id: int, product_id: int, user_id: int = Depends(get_current_user_info)):
    """生成口播文案

    Args:
        streamer_id (int): 主播 ID，用于获取性格等信息
        product_id (int): 商品 ID
    """

    prompt = await gen_poduct_base_prompt(user_id, streamer_id, product_id)

    res_data = await get_llm_res(prompt)

    return make_return_data(True, ResultCode.SUCCESS, "成功", res_data)


@router.get("/gen_product_info")
async def get_product_info_api(product_id: int, user_id: int = Depends(get_current_user_info)):
    """TODO 根据说明书内容生成商品信息

    Args:
        gen_product_item (GenProductItem): _description_
    """

    raise NotImplemented()
    instruction_str = ""
    prompt = [{"system": "现在你是一个文档小助手，你可以从文档里面总结出我需要的信息", "input": ""}]

    res_data = ""
    model_name = LLM_MODEL_HANDLER.available_models[0]
    for item in LLM_MODEL_HANDLER.chat_completions_v1(model=model_name, messages=prompt):
        res_data += item
