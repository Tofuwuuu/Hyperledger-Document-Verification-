from fastapi import APIRouter

router = APIRouter()


def _stub_response(name: str, extra: dict | None = None) -> dict:
    payload = {"stub": True, "endpoint": name, "message": "This is a backend stub. Implement real behavior as needed."}
    if extra:
        payload.update(extra)
    return payload


# Hyperledger / Fabric-related admin endpoints (still stubbed)
@router.get("/hyperledger/networks")
async def list_hl_networks():
    return _stub_response("/hyperledger/networks")


@router.get("/hyperledger/channels")
async def list_hl_channels():
    return _stub_response("/hyperledger/channels")


@router.get("/hyperledger/chaincodes")
async def list_hl_chaincodes():
    return _stub_response("/hyperledger/chaincodes")


@router.post("/hyperledger/invoke")
async def hyperledger_invoke():
    return _stub_response("/hyperledger/invoke")


@router.post("/hyperledger/query")
async def hyperledger_query():
    return _stub_response("/hyperledger/query")
