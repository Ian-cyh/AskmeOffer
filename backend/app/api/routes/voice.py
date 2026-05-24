"""Voice interview WebSocket endpoint + Paraformer ASR HTTP endpoint.

Pipeline (browser ASR mode):
  Browser SpeechRecognition → text → WebSocket → DeepSeek LLM → text
  → Edge TTS → MP3 → WebSocket → Browser plays

Pipeline (server ASR mode):
  Browser MediaRecorder → audio blob → POST /api/voice/asr
  → ffmpeg PCM → Paraformer → text → DeepSeek correction → WebSocket user_text
  → DeepSeek LLM → Edge TTS → MP3 → WebSocket → Browser plays
"""

import json
import traceback

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException

from app.services.llm.client import collect_chat
from app.services.interview.context import get_or_create_session, ASR_NOTICE
from app.services.voice.edge_tts_service import synthesize_edge_full, VOICE as DEFAULT_VOICE
from app.services.voice.asr import recognize_audio
from app.core.config import DASHSCOPE_API_KEY

# --- ASR correction prompt ---
_ASR_CORRECTION_SYSTEM = """你是一名语音识别纠错助手。
候选人正在进行保研面试，其语音被语音识别引擎转写为以下文字，但因引擎对专业术语不熟悉，
可能存在：谐音错字（"DOE"→"doe"/"兜"，"衍射"→"演射"/"演社"，"高斯"→"高丝瓜"，
"Gaussian"→"高斯演"，"菲涅尔"→"菲尼尔演社"等）、英文缩写被拆分或识别错误。

请根据以下候选人背景，将识别文字还原为最可能的正确表述：
- 仅修正明显的识别错误，保留候选人原意和口语化表达
- 不要补充额外内容，不要改变句意
- 直接输出纠错后的文字，不要任何解释"""


async def correct_asr(raw_text: str, profile_summary: str) -> str:
    """Use LLM to correct ASR transcription errors given interview context."""
    if not raw_text.strip():
        return raw_text
    context = profile_summary[:800] if profile_summary else "理工科本科生，研究方向为光学/人工智能/计算机"
    user_msg = f"候选人背景摘要：\n{context}\n\nASR 识别文字（可能有误）：\n{raw_text}"
    try:
        corrected = await collect_chat(_ASR_CORRECTION_SYSTEM, user_message=user_msg)
        return corrected.strip() or raw_text
    except Exception:
        return raw_text

router = APIRouter()


@router.post("/tts")
async def text_to_speech(payload: dict):
    """Simple TTS endpoint: POST {text, voice?} → returns MP3 audio blob."""
    from fastapi.responses import Response
    from app.services.voice.edge_tts_service import synthesize_edge_full, VOICE as DEFAULT_VOICE
    text = payload.get("text", "").strip()
    voice = payload.get("voice", DEFAULT_VOICE)
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    try:
        audio = await synthesize_edge_full(text, voice=voice)
        return Response(content=audio, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")


@router.post("/asr")
async def paraformer_asr(audio: UploadFile = File(...)):
    """Receive an audio file from the browser (WebM/OGG/WAV) and return Paraformer ASR text."""
    if not DASHSCOPE_API_KEY:
        raise HTTPException(status_code=503, detail="DASHSCOPE_API_KEY not configured")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    try:
        text = await recognize_audio(audio_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ASR failed: {e}")

    return {"text": text}


DIFFICULTY_MAP = {
    "easy": "温和友善，以鼓励为主，提问难度适中，不做过多追问",
    "standard": "专业严谨，会就回答中的细节追问 1-2 层，评估深度理解",
    "pressure": "严格高压，频繁追问细节和边界情况，模拟真实压力面试",
}

INTERVIEW_SYSTEM = """你是一位经验丰富的保研面试官，正在对一位申请研究生的本科生进行语音模拟面试。{interviewer_block}

面试规则：
1. 基于候选人的完整背景资料提问，重点考察项目经历的技术深度和个人贡献
2. 每次只问一个问题，等候选人回答后再继续
3. 根据回答质量决定是追问还是换下一题
4. 追问要具体，针对回答中的薄弱点或模糊之处
5. 面试风格：{difficulty_desc}
6. 使用中文交流，回答简洁（控制在 2-3 句话，适合语音输出）
7. 保持面试官的角色，不要给出答案或提示
8. 不要使用 Markdown 格式、星号、列表符号等，只用纯文本
9. 【重要】候选人的姓名在背景资料里，那是候选人的名字，不是你的名字。你绝对不能用候选人的姓名来称呼自己。

{greeting_instruction}"""


def _build_system(ctx) -> str:
    difficulty_desc = DIFFICULTY_MAP.get(ctx.difficulty, DIFFICULTY_MAP["standard"])
    interviewer_block = ""
    if ctx.interviewer_info:
        interviewer_block = f"\n\n【你的身份】{ctx.interviewer_info}\n请以此身份主持面试。"
        greeting_instruction = "面试开始时先用你自己的真实姓名和单位进行简短自我介绍，然后请候选人做自我介绍。"
    else:
        greeting_instruction = "面试开始时说「你好，我是今天的面试官」，然后请候选人做自我介绍。不要报出任何具体姓名。"
    system = INTERVIEW_SYSTEM.format(
        difficulty_desc=difficulty_desc,
        interviewer_block=interviewer_block,
        greeting_instruction=greeting_instruction,
    )
    system += f"\n\n{ctx.profile_summary}"
    system += f"\n\n{ctx.profile_summary}"
    if ctx.uploaded_materials:
        system += "\n\n=== 候选人补充材料 ===\n"
        system += "\n---\n".join(ctx.uploaded_materials)
    # Inject past interview memory
    if ctx.past_memory:
        system += f"\n\n=== 候选人历史面试记录（作为参考）===\n{ctx.past_memory}"
    # Inject ASR error tolerance notice when using voice ASR
    if ctx.asr_mode:
        system += ASR_NOTICE
    return system


@router.websocket("/ws/{session_id}")
async def voice_interview(ws: WebSocket, session_id: str):
    await ws.accept()
    ctx = get_or_create_session(session_id)

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)
            action = data.get("action", "")

            if action == "start":
                ctx.difficulty = data.get("difficulty", "standard")
                ctx.asr_mode = data.get("asr_mode", False)
                ctx.past_memory = data.get("past_memory", "")
                ctx.tts_voice = data.get("tts_voice", "zh-CN-YunxiNeural")
                ctx.interviewer_info = data.get("interviewer_info", "")
                ctx.active = True
                system = _build_system(ctx)

                try:
                    await ws.send_json({"type": "status", "message": "面试官准备中..."})
                    response_text = await collect_chat(
                        system,
                        messages=[{"role": "user", "content": "你好，我准备好了，请开始面试。"}],
                    )
                except Exception as e:
                    await ws.send_json({"type": "error", "message": f"LLM 调用失败：{e}"})
                    continue

                ctx.history = [
                    {"role": "user", "content": "你好，我准备好了，请开始面试。"},
                    {"role": "assistant", "content": response_text},
                ]
                ctx.questions_asked = 1

                await ws.send_json({"type": "assistant_text", "text": response_text})

                # TTS: generate and send audio
                try:
                    await ws.send_json({"type": "status", "message": "生成语音..."})
                    audio_data = await synthesize_edge_full(response_text, voice=ctx.tts_voice)
                    await ws.send_bytes(audio_data)
                    await ws.send_json({"type": "audio_done"})
                except Exception as e:
                    await ws.send_json({"type": "tts_fallback", "text": response_text})
                    print(f"TTS error: {e}")

            elif action == "user_text":
                raw_text = data.get("text", "").strip()
                if not raw_text:
                    await ws.send_json({"type": "error", "message": "未收到文本"})
                    continue

                # ASR correction: fix misrecognized technical terms using LLM
                await ws.send_json({"type": "status", "message": "识别纠错中..."})
                user_text = await correct_asr(raw_text, ctx.profile_summary)

                # If text changed, notify frontend of correction
                if user_text != raw_text:
                    await ws.send_json({"type": "asr_corrected", "raw": raw_text, "corrected": user_text})

                ctx.history.append({"role": "user", "content": user_text})
                await ws.send_json({"type": "user_text", "text": user_text})
                await ws.send_json({"type": "status", "message": "面试官思考中..."})

                system = _build_system(ctx)

                try:
                    response_text = await collect_chat(system, messages=ctx.history)
                except Exception as e:
                    await ws.send_json({"type": "error", "message": f"LLM 调用失败：{e}"})
                    continue

                ctx.history.append({"role": "assistant", "content": response_text})
                ctx.questions_asked += 1

                await ws.send_json({"type": "assistant_text", "text": response_text})

                # TTS
                try:
                    await ws.send_json({"type": "status", "message": "生成语音..."})
                    audio_data = await synthesize_edge_full(response_text, voice=ctx.tts_voice)
                    await ws.send_bytes(audio_data)
                    await ws.send_json({"type": "audio_done"})
                except Exception as e:
                    await ws.send_json({"type": "tts_fallback", "text": response_text})
                    print(f"TTS error: {e}")

            elif action == "end_interview":
                # Generate feedback before closing
                if len(ctx.history) >= 2:
                    try:
                        await ws.send_json({"type": "status", "message": "正在生成面试反馈..."})

                        conversation = "\n".join(
                            f"{'面试官' if m['role'] == 'assistant' else '候选人'}：{m['content']}"
                            for m in ctx.history
                        )

                        FEEDBACK_SYSTEM = """你是一位资深的保研面试辅导专家，需要从"面试评委听者的视角"给候选人写一份深度反馈。
面试者说话时感觉和听者听到的效果往往不同——你的任务是帮候选人意识到听者的真实感受。

请严格按以下 JSON 格式输出（不要输出其他内容）：
{
  "summary": "整体面试表现总结（120字以内，包含整体印象和核心建议）",
  "questions": [
    {
      "question": "面试官提出的问题",
      "answer": "候选人的回答要点摘要",
      "evaluation": "对该回答的准确性评价",
      "expression_advice": "语言表达优化建议：从听者角度指出表述问题并给出改进话术示例",
      "suggested_answer": "参考回答或改进方向。规则：基础概念→直接给标准答案；项目细节→不编造，指出缺少什么信息并告诉候选人去准备什么；开放性问题→给回答框架",
      "score": "A/B/C/D"
    }
  ],
  "strengths": ["优势1", "优势2"],
  "improvements": ["待提升点1", "待提升点2"],
  "expression_summary": "整体语言表达点评（50-100字）：从听者感受角度总结表达习惯问题",
  "overallScore": "A/B/C/D 评级 + 一句话说明"
}

重要：基础知识直接给标准答案；项目细节不编造，引导候选人查阅准备；expression_advice 从评委听到时的真实感受出发。禁止使用中文引号""，举例请用反引号。"""

                        result = await collect_chat(
                            FEEDBACK_SYSTEM,
                            user_message=f"面试对话记录：\n\n{conversation}",
                        )

                        import json as json_mod
                        cleaned = result.strip()
                        if cleaned.startswith("```"):
                            cleaned = "\n".join(cleaned.split("\n")[1:])
                        if cleaned.endswith("```"):
                            cleaned = cleaned[: cleaned.rfind("```")]
                        try:
                            feedback = json_mod.loads(cleaned.strip())
                        except json_mod.JSONDecodeError:
                            feedback = {"summary": result, "questions": [], "strengths": [], "improvements": [], "overallScore": "未评级"}

                        await ws.send_json({"type": "feedback", "feedback": feedback})
                    except Exception as e:
                        await ws.send_json({"type": "error", "message": f"反馈生成失败：{e}"})

                ctx.active = False

    except WebSocketDisconnect:
        ctx.active = False
    except Exception:
        traceback.print_exc()
        try:
            await ws.send_json({"type": "error", "message": "服务器内部错误"})
        except Exception:
            pass
