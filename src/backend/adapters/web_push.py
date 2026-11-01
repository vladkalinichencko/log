import asyncio
import base64
import json
from pathlib import Path
from typing import cast

from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePublicKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid02
from pywebpush import WebPushException, webpush

from .json_store import save_document

PUSH_DOCUMENT = "push"
VAPID_CONTACT = "https://github.com"
GONE = {404, 410}
PUSH_TIMEOUT_SECONDS = 10


class WebPushTransport:

    def __init__(self, runs_root: Path):
        self.runs_root = runs_root

    def public_key(self) -> str:
        public_key = cast(EllipticCurvePublicKey, self._vapid().public_key)
        point = public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        return base64.urlsafe_b64encode(point).decode().rstrip("=")

    def subscribe(self, subscription: dict) -> None:
        document = self._document()
        others = [saved for saved in document["subscriptions"] if saved["endpoint"] != subscription["endpoint"]]
        save_document(self.runs_root, PUSH_DOCUMENT, {**document, "subscriptions": [*others, subscription]})

    def unsubscribe(self, endpoint: str) -> None:
        document = self._document()
        kept = [saved for saved in document["subscriptions"] if saved["endpoint"] != endpoint]
        save_document(self.runs_root, PUSH_DOCUMENT, {**document, "subscriptions": kept})

    async def push(self, event: dict) -> None:
        if event["type"] != "alert":
            return
        payload = json.dumps({"title": event["run"].replace("/", "."), "body": event["text"], "url": f"/{event['run'].replace('/', '.')}"})
        vapid = self._vapid()
        for subscription in self._document()["subscriptions"]:
            try:
                await asyncio.to_thread(webpush, subscription, payload, vapid_private_key=vapid, vapid_claims={"sub": VAPID_CONTACT}, timeout=PUSH_TIMEOUT_SECONDS)
            except WebPushException as error:
                if error.response is not None and error.response.status_code in GONE:
                    self.unsubscribe(subscription["endpoint"])

    def _vapid(self) -> Vapid02:
        return Vapid02.from_pem(self._document()["vapid_private_key"].encode())

    def _document(self) -> dict:
        path = self.runs_root / f"{PUSH_DOCUMENT}.json"
        if path.exists():
            return json.loads(path.read_text())
        vapid = Vapid02()
        vapid.generate_keys()
        return save_document(self.runs_root, PUSH_DOCUMENT, {"vapid_private_key": vapid.private_pem().decode(), "subscriptions": []})
