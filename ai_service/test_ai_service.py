import os
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ai_service_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "RapidOCR" in data["engines"]["ocr"]


def test_ai_service_process_image(tmp_path):
    import cv2
    import numpy as np

    img_path = str(tmp_path / "sample.jpg")
    img = np.full((120, 400, 3), 250, dtype=np.uint8)
    cv2.putText(img, "NET WT 500 g", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (10, 10, 10), 2)
    cv2.imwrite(img_path, img)

    out_path = str(tmp_path / "sample_out.jpg")
    response = client.post(
        "/api/v1/process-image",
        json={"image_path": img_path, "output_path": out_path}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total_tokens"] > 0
    assert any("500" in t["text"] or "NET" in t["text"] for t in data["tokens"])
    print("\nAI Microservice Test PASSED! Detected:", [t["text"] for t in data["tokens"]])


if __name__ == "__main__":
    test_ai_service_health()
    import tempfile, pathlib
    with tempfile.TemporaryDirectory() as td:
        test_ai_service_process_image(pathlib.Path(td))
