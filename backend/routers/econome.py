from fastapi import APIRouter, Form
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/econome", tags=["ÉCONOMÉ"])

SYSTEMS = {
    "Eker":     {"NEC": 55, "FFA": 10, "LTS": 10, "EDU": 10, "PLY": 10, "GIV": 5},
    "Improved": {"NEC": 47, "FFA": 30, "LTS": 10, "EDU": 5,  "PLY": 3,  "GIV": 5},
    "Économé":  {"NEC": 47, "FFA": 15, "LTS": 17, "EDU": 13, "PLY": 3,  "GIV": 5},
}

@router.get("/systems")
async def get_systems():
    """Return available systems and percentages"""
    return SYSTEMS

@router.post("/calculate")
async def calculate_distribution(
    income: float = Form(...),
    system: str = Form(...)
):
    if system not in SYSTEMS:
        return JSONResponse({"error": "Invalid system"}, status_code=400)

    percents = SYSTEMS[system]
    result = {jar: round(income * (p / 100), 2) for jar, p in percents.items()}
    result["Total"] = round(sum(result.values()), 2)
    return result
 