"""Code execution endpoint — Python / C / C++."""

from __future__ import annotations

import asyncio
import os
import subprocess
import tempfile
from pydantic import BaseModel
from fastapi import APIRouter

router = APIRouter()

TIMEOUT = 10


class RunRequest(BaseModel):
    language: str
    code: str
    stdin: str = ""


def _run_sync(language: str, code: str, stdin: str = "") -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        if language == "python":
            src = os.path.join(tmpdir, "main.py")
            with open(src, "w", encoding="utf-8") as f:
                f.write(code)
            result = subprocess.run(
                ["python3", src],
                input=stdin,
                capture_output=True, text=True, timeout=TIMEOUT, cwd=tmpdir,
            )
        elif language in ("c", "cpp"):
            ext = ".c" if language == "c" else ".cpp"
            compiler = "gcc" if language == "c" else "g++"
            src = os.path.join(tmpdir, f"main{ext}")
            exe = os.path.join(tmpdir, "main")
            with open(src, "w", encoding="utf-8") as f:
                f.write(code)
            compile_result = subprocess.run(
                [compiler, src, "-o", exe, "-lm", "-std=c++17"] if language == "cpp"
                else [compiler, src, "-o", exe, "-lm"],
                capture_output=True, text=True, timeout=TIMEOUT, cwd=tmpdir,
            )
            if compile_result.returncode != 0:
                return {
                    "stdout": "",
                    "stderr": compile_result.stderr,
                    "exit_code": compile_result.returncode,
                    "error": "编译错误",
                }
            result = subprocess.run(
                [exe],
                input=stdin,
                capture_output=True, text=True, timeout=TIMEOUT, cwd=tmpdir,
            )
        else:
            return {"stdout": "", "stderr": "不支持的语言", "exit_code": -1, "error": "不支持的语言"}

        return {
            "stdout": result.stdout[:8000],
            "stderr": result.stderr[:2000],
            "exit_code": result.returncode,
            "error": None,
        }


@router.post("/run")
async def run_code(req: RunRequest):
    try:
        result = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None, _run_sync, req.language, req.code, req.stdin
            ),
            timeout=TIMEOUT + 2,
        )
    except asyncio.TimeoutError:
        result = {"stdout": "", "stderr": "执行超时（>10秒）", "exit_code": -1, "error": "超时"}
    except Exception as e:
        result = {"stdout": "", "stderr": str(e), "exit_code": -1, "error": str(e)}
    return result
