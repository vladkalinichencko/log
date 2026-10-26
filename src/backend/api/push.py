from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..adapters.web_push import WebPushTransport
from ..config import get_push

router = APIRouter()


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str
    keys: PushKeys


class PushEndpoint(BaseModel):
    endpoint: str


@router.get("/api/push/key")
def get_push_key(push: WebPushTransport = Depends(get_push)) -> dict:
    return {"key": push.public_key()}


@router.put("/api/push/subscriptions")
def save_push_subscription(subscription: PushSubscription, push: WebPushTransport = Depends(get_push)) -> dict:
    push.subscribe(subscription.model_dump())
    return {"subscribed": True}


@router.delete("/api/push/subscriptions")
def delete_push_subscription(subscription: PushEndpoint, push: WebPushTransport = Depends(get_push)) -> dict:
    push.unsubscribe(subscription.endpoint)
    return {"subscribed": False}
