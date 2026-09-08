"""
Camera Streaming Client
- RTSP / Video file → WebSocket server
- ONNX YOLO26n inference (CPU-optimized for Raspberry Pi 5)
- GPS + Compass via I2C / Serial
- ONVIF PTZ control

Protocol: struct.pack('<I', len(meta_json)) + meta_json + jpg_bytes
"""

import asyncio
import math
import os
import struct
import time
import datetime
import threading
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
import onnxruntime as ort
import orjson
import serial
import pynmea2
import smbus2
import websockets
from onvif import ONVIFCamera
from dotenv import load_dotenv
import jwt

try:
    import uvloop
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
except ImportError:
    pass

cv2.setNumThreads(2)
load_dotenv()

# ── Identity ────────────────────────────────────────────────────────────────
CAMERA_ID         = os.getenv("CAMERA_ID")
CAMERA_LATITUDE   = float(os.getenv("CAMERA_LATITUDE"))
CAMERA_LONGITUDE  = float(os.getenv("CAMERA_LONGITUDE"))

# ── Server ──────────────────────────────────────────────────────────────────
HOST              = os.getenv("HOST")
PORT              = os.getenv("PORT")
SERVER_URI        = f"ws://{HOST}:{PORT}/camera{CAMERA_ID}" if PORT else f"ws://{HOST}/camera{CAMERA_ID}"
JWT_SECRET        = os.getenv("JWT_SECRET")
RECONNECT_DELAY   = 5

# ── Stream ──────────────────────────────────────────────────────────────────
FPS               = 25
QUALITY           = 50
OUT_W, OUT_H      = 960, 540
USE_UDP           = False

# ── ONVIF / PTZ ──────────────────────────────────────────────────────────────
CAMERA_IP         = os.getenv("CAMERA_IP")
CAMERA_USERNAME   = os.getenv("CAMERA_USERNAME")
CAMERA_PASSWORD   = os.getenv("CAMERA_PASSWORD")
ONVIF_PORT        = os.getenv("ONVIF_PORT")
PTZ_ENABLED       = True
max_pan_deg       = 180
max_tilt_deg      = 45
PTZ_POLL_INTERVAL = 3   # seconds between ONVIF GetStatus polls

# ── Source (set one) ─────────────────────────────────────────────────────────
USE_RTSP          = False
VIDEO_PATH        = "captures/videos/1788409237442_0.mp4"
RTSP_URL          = f"rtsp://{CAMERA_USERNAME}:{CAMERA_PASSWORD}@{CAMERA_IP}:554/stream1"

# ── AI ───────────────────────────────────────────────────────────────────────
MODEL_PT_PATH     = "models/2026_09_07_640x_no_aug.pt"
MODEL_ONNX_PATH   = "models/onnx_model/2026_09_07_640x_no_aug.onnx"
CONF_THRESHOLD    = 0.3
FRAME_SKIP        = 8
INFER_W, INFER_H  = 640, 640
AI_ENABLED        = True

# ── GPS / Compass ─────────────────────────────────────────────────────────────
GPS_PORT          = "/dev/ttyAMA0"
GPS_BAUDRATE      = 9600
COMPASS_ADDR      = 0x2C
COMPASS_X_OFFSET  = -88.5
COMPASS_Y_OFFSET  = -286.5
SENSOR_INTERVAL   = 10          # seconds between reads

# ── Shared state (written by sensor workers, read by stream sender) ────────────
shared = {
    "latitude":  CAMERA_LATITUDE,
    "longitude": CAMERA_LONGITUDE,
    "heading":   0.0,
    "current_pan": 0.0,   # real position, polled from camera via ONVIF GetStatus
    "current_tilt": 0.0,
    "target_pan": 0.0,    # last commanded target, used as baseline for relative moves
    "target_tilt": 0.0,
}

# ─────────────────────────────────────────────────────────────────────────────
# PTZ
# ─────────────────────────────────────────────────────────────────────────────

def generate_camera_token():
    payload = {
        "camera_id": CAMERA_ID,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def init_ptz():
    if not PTZ_ENABLED:
        print("PTZ disabled (PTZ_ENABLED=False)")
        return None, None
    try:
        cam     = ONVIFCamera(CAMERA_IP, ONVIF_PORT, CAMERA_USERNAME, CAMERA_PASSWORD)
        ptz     = cam.create_ptz_service()
        token   = cam.create_media_service().GetProfiles()[0].token
        print(f"ONVIF connected (token={token})")
        return ptz, token
    except Exception as exc:
        print(f"ONVIF failed: {exc}")
        return None, None

def calculate_onvif_position(target_pan_deg: float, target_tilt_deg: float) -> tuple:
    pan_normalized = target_pan_deg / max_pan_deg
    tilt_normalized = target_tilt_deg / max_tilt_deg
    pan_normalized = max(-1.0, min(1.0, pan_normalized))
    tilt_normalized = max(-1.0, min(1.0, tilt_normalized))
    return pan_normalized, tilt_normalized
    
def get_ptz_status(ptz, token) -> tuple:
    if ptz is None:
        return None, None
    try:
        req = ptz.create_type("GetStatus")
        req.ProfileToken = token
        status = ptz.GetStatus(req)

        ptz_position = status.Position
        pan_norm = ptz_position.PanTilt.x
        tilt_norm = ptz_position.PanTilt.y

        current_pan_deg = pan_norm * max_pan_deg
        current_tilt_deg = tilt_norm * max_tilt_deg
        return current_pan_deg, current_tilt_deg

    except Exception as exc:
        print(f"Cannot read camera's position: {exc}")
        return None, None

def ptz_absolute_move(ptz, token, pan_val: float, tilt_val: float, zoom_val: float = None):
    if ptz is None:
        return
    try:
        req = ptz.create_type("AbsoluteMove")
        req.ProfileToken = token

        pan_norm, tilt_norm = calculate_onvif_position(pan_val, tilt_val)

        req.Position = {"PanTilt": {"x": pan_norm, "y": tilt_norm}}
        if zoom_val is not None:
            req.Position["Zoom"] = {"x": zoom_val}

        ptz.AbsoluteMove(req)
        shared["target_pan"] = pan_val
        shared["target_tilt"] = tilt_val
        print(f"Moving absolutely to Pan: {pan_val}, Tilt: {tilt_val}")
    except Exception as exc:
        print(f"Absolute Move error: {exc}")

def ptz_status_worker(ptz, token):
    """Poll the camera's real position over ONVIF and keep `shared` current_pan/tilt in sync."""
    if ptz is None:
        return
    print("PTZ status worker started")
    while True:
        pan_deg, tilt_deg = get_ptz_status(ptz, token)
        if pan_deg is not None and tilt_deg is not None:
            shared["current_pan"] = pan_deg
            shared["current_tilt"] = tilt_deg
        time.sleep(PTZ_POLL_INTERVAL)

def apply_stream_settings(command):
    global OUT_W, OUT_H, QUALITY
    width = command.get("width")
    height = command.get("height")
    quality = command.get("quality")

    if isinstance(width, (int, float)) and isinstance(height, (int, float)) and width > 0 and height > 0:
        OUT_W, OUT_H = int(width), int(height)
        print(f"Stream resolution set to {OUT_W}x{OUT_H}")

    if isinstance(quality, (int, float)):
        QUALITY = max(1, min(100, int(quality)))
        print(f"Stream JPEG quality set to {QUALITY}")

def apply_ai_toggle(command):
    global AI_ENABLED
    enabled = command.get("enabled")
    if isinstance(enabled, bool):
        AI_ENABLED = enabled
        print(f"AI detection {'enabled' if AI_ENABLED else 'disabled'}")

def apply_ai_settings(command):
    global CONF_THRESHOLD, FRAME_SKIP
    confidence = command.get("confidence")
    frame_skip = command.get("frameSkip")

    if isinstance(confidence, (int, float)):
        CONF_THRESHOLD = max(0.0, min(1.0, float(confidence)))
        print(f"AI confidence threshold set to {CONF_THRESHOLD}")

    if isinstance(frame_skip, (int, float)) and frame_skip >= 1:
        FRAME_SKIP = max(1, min(60, int(frame_skip)))
        print(f"AI frame skip set to {FRAME_SKIP}")

def ptz_worker(ptz, token, command):
    ctrl_type = command.get("controlType")
    
    try:    
        if ctrl_type == "absolutely":
            ptz_absolute_move(ptz, token, command.get("pan"), command.get("tilt"))
        elif ctrl_type == "continuously":
            direction = command.get("direction")
            degree = command.get("deg")
            pan = shared["target_pan"]
            tilt = shared["target_tilt"]
            
            if direction == "left":
                ptz_absolute_move(ptz, token, pan - degree, tilt)
            elif direction == "right":
                ptz_absolute_move(ptz, token, pan + degree, tilt)
            elif direction == "up":
                ptz_absolute_move(ptz, token, pan, tilt - degree)
            elif direction == "down":
                ptz_absolute_move(ptz, token, pan, tilt + degree)
    except Exception as exc:
        print(f"Error during PTZ move: {exc}")

# ─────────────────────────────────────────────────────────────────────────────
# Sensor readiness checks
# ─────────────────────────────────────────────────────────────────────────────

GPS_CHECK_RETRIES  = 1
GPS_CHECK_INTERVAL = 5  # seconds per attempt


def check_gps() -> bool:
    """Try opening the GPS serial port and reading valid NMEA data, with retries."""
    for attempt in range(1, GPS_CHECK_RETRIES + 1):
        try:
            with serial.Serial(GPS_PORT, baudrate=GPS_BAUDRATE, timeout=GPS_CHECK_INTERVAL) as ser:
                deadline = time.monotonic() + GPS_CHECK_INTERVAL
                while time.monotonic() < deadline:
                    line = ser.readline().decode("utf-8", errors="ignore").strip()
                    if line.startswith("$GP") or line.startswith("$GN"):
                        print(f"GPS check OK on attempt {attempt}/{GPS_CHECK_RETRIES} ({line[:20]}…)")
                        return True
            print(f"GPS check attempt {attempt}/{GPS_CHECK_RETRIES}: no NMEA data")
        except Exception as exc:
            print(f"GPS check attempt {attempt}/{GPS_CHECK_RETRIES} FAILED: {exc}")

        if attempt < GPS_CHECK_RETRIES:
            print(f"Retrying GPS in {GPS_CHECK_INTERVAL}s…")
            time.sleep(GPS_CHECK_INTERVAL)

    print(f"GPS not responding after {GPS_CHECK_RETRIES} attempts")
    return False


def check_compass() -> bool:
    """Try initializing the compass over I2C and reading the status register."""
    try:
        bus = smbus2.SMBus(1)
        _init_compass(bus)
        status = bus.read_byte_data(COMPASS_ADDR, 0x09)
        bus.close()
        print(f"Compass check OK (status=0x{status:02X})")
        return True
    except Exception as exc:
        print(f"Compass check FAILED: {exc}")
        return False

# ─────────────────────────────────────────────────────────────────────────────
# GPS worker (blocking, runs in thread)
# ─────────────────────────────────────────────────────────────────────────────

def gps_worker():
    ser        = serial.Serial(GPS_PORT, baudrate=GPS_BAUDRATE, timeout=1)
    next_read  = 0.0
    print("GPS worker started")

    while True:
        now = time.monotonic()
        if now < next_read:
            time.sleep(0.5)
            continue
        next_read = now + SENSOR_INTERVAL

        line = ser.readline().decode("utf-8", errors="ignore")
        if not (line.startswith("$GPRMC") or line.startswith("$GPGGA")):
            continue
        try:
            msg = pynmea2.parse(line)
            has_fix = (msg.gps_qual > 0) if hasattr(msg, "gps_qual") else (msg.status == "A")
            if has_fix:
                shared["latitude"]  = msg.latitude
                shared["longitude"] = msg.longitude
            else:
                print("GPS: no fix")
        except pynmea2.ParseError:
            pass

# ─────────────────────────────────────────────────────────────────────────────
# Compass worker (blocking, runs in thread)
# ─────────────────────────────────────────────────────────────────────────────

def _init_compass(bus: smbus2.SMBus):
    bus.write_byte_data(COMPASS_ADDR, 0x29, 0x06)
    bus.write_byte_data(COMPASS_ADDR, 0x0B, 0x08)
    bus.write_byte_data(COMPASS_ADDR, 0x0A, 0xCD)


def _read_heading(bus: smbus2.SMBus) -> float:
    data = bus.read_i2c_block_data(COMPASS_ADDR, 0x01, 6)
    x = data[0] | (data[1] << 8)
    y = data[2] | (data[3] << 8)

    if x > 32767: x -= 65536
    if y > 32767: y -= 65536

    heading = math.atan2(y - COMPASS_Y_OFFSET, x - COMPASS_X_OFFSET)
    if heading < 0:
        heading += 2 * math.pi
    return math.degrees(heading)


def compass_worker():
    try:
        bus       = smbus2.SMBus(1)
        _init_compass(bus)
        print("Compass worker started")
    except Exception as exc:
        print(f"Failed to initialize Compass: {exc}")
        shared["heading"] = -999.0
        return 
    
    next_read = 0.0
    while True:
        now = time.monotonic()
        if now < next_read:
            time.sleep(0.5)
            continue
        next_read = now + SENSOR_INTERVAL
        try:
            status = bus.read_byte_data(COMPASS_ADDR, 0x09)
            if status & 0x01:
                shared["heading"] = _read_heading(bus)
        except Exception as exc:
            print(f"Compass error: {exc}")

# ─────────────────────────────────────────────────────────────────────────────
# ONNX inference
# ─────────────────────────────────────────────────────────────────────────────

def _export_onnx_if_needed():
    if os.path.exists(MODEL_ONNX_PATH):
        return
    print("Exporting .pt → .onnx (one-time)…")
    from ultralytics import YOLO
    os.makedirs(os.path.dirname(MODEL_ONNX_PATH), exist_ok=True)
    model = YOLO(MODEL_PT_PATH)
    model.export(format="onnx", imgsz=(INFER_H, INFER_W), half=False, simplify=True, opset=17, nms=True, dynamic=False)
    exported = MODEL_PT_PATH.replace(".pt", ".onnx")
    if exported != MODEL_ONNX_PATH:
        os.rename(exported, MODEL_ONNX_PATH)
    print(f"Exported → {MODEL_ONNX_PATH}")


def load_session() -> ort.InferenceSession:
    _export_onnx_if_needed()

    opts = ort.SessionOptions()
    opts.graph_optimization_level  = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    opts.execution_mode            = ort.ExecutionMode.ORT_SEQUENTIAL
    opts.intra_op_num_threads      = os.cpu_count()
    opts.inter_op_num_threads      = 1
    opts.optimized_model_filepath  = MODEL_ONNX_PATH.replace(".onnx", "_opt.onnx")

    session = ort.InferenceSession(
        MODEL_ONNX_PATH,
        sess_options=opts,
        providers=["CPUExecutionProvider"],
    )
    print("ONNX session loaded")
    return session


# Pre-allocate reusable input buffer
_infer_buffer = np.zeros((1, 3, INFER_H, INFER_W), dtype=np.float32)

def run_inference(session: ort.InferenceSession, input_name: str, frame_bgr: np.ndarray) -> np.ndarray:
    """BGR frame → filtered detections array (shape N×6: x1 y1 x2 y2 conf cls)."""
    np.divide(
        cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB).transpose(2, 0, 1),
        255.0,
        out=_infer_buffer[0],
        casting="unsafe",
    )
    raw = session.run(None, {input_name: _infer_buffer})[0]  # (1, N, 6)
    dets = raw[0]
    return dets[dets[:, 4] >= CONF_THRESHOLD]

# ─────────────────────────────────────────────────────────────────────────────
# Packet builder
# ─────────────────────────────────────────────────────────────────────────────

def build_packet(detections: np.ndarray | None, jpg_bytes: bytes) -> bytes:
    uavs = []
    if detections is not None and len(detections):
        for x1, y1, x2, y2, conf, _ in detections:
            uavs.append({
                "boxes": {"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2)},
                "confs": float(conf),
            })

    meta = orjson.dumps({
        "uavs":       uavs,
        "camera":     {"camera_id": CAMERA_ID, "lat": shared["latitude"], "lon": shared["longitude"]},
        "heading":    {"installFace": shared["heading"], "currentPan": shared["current_pan"], "currentTilt": shared["current_tilt"]},
        "image_size": {"model_size": [INFER_W, INFER_H]},
        "controllable":  PTZ_ENABLED,
        "streamConfig": {"width": OUT_W, "height": OUT_H, "quality": QUALITY},
        "ai": {"enabled": AI_ENABLED, "confidence": CONF_THRESHOLD, "frameSkip": FRAME_SKIP},
        "timestamp":  datetime.datetime.now().isoformat(),
    })
    return struct.pack("<I", len(meta)) + meta + jpg_bytes

# ─────────────────────────────────────────────────────────────────────────────
# Camera reader thread — always holds the LATEST frame
# ─────────────────────────────────────────────────────────────────────────────

class CameraReader:
    """Dedicated thread อ่านกล้องตลอดเวลา เก็บแค่ frame ล่าสุด
    
    ทำไมถึงแก้ frame drop:
    - FFmpeg internal buffer จะไม่ล้น เพราะ thread นี้อ่านทิ้งตลอด
    - Sender loop หยิบ frame ไปใช้เมื่อพร้อม ไม่ต้องรอ decode
    - ถ้า sender ช้า (network lag, JPEG encode) ก็แค่ข้าม frame ที่เก่าไป
      ไม่มี backlog สะสม
    """

    def __init__(self, source, is_rtsp: bool):
        self._source = source
        self._is_rtsp = is_rtsp
        self._lock = threading.Lock()
        self._frame = None          # latest decoded frame (numpy array)
        self._frame_id = 0          # increments on every new frame
        self._running = True
        self._cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self):
        """อ่าน frame วนลูปตลอด — ไม่มี sleep เพราะ cap.read() จะ block
        จนกว่าจะมี frame ใหม่จากกล้อง (ตาม FPS ของกล้อง)"""
        fail_count = 0
        while self._running:
            ret, frame = self._cap.read()
            if not ret:
                fail_count += 1
                if self._is_rtsp and fail_count >= 10:
                    print(f"CameraReader: {fail_count} consecutive failures — reopening…")
                    self._cap.release()
                    time.sleep(1)
                    self._cap = cv2.VideoCapture(self._source, cv2.CAP_FFMPEG)
                    self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    fail_count = 0
                elif not self._is_rtsp:
                    # video file loop
                    self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                else:
                    time.sleep(0.01)
                continue

            fail_count = 0
            with self._lock:
                self._frame = frame
                self._frame_id += 1

    def grab(self):
        """คืน (frame, frame_id) ล่าสุด หรือ (None, -1) ถ้ายังไม่มี"""
        with self._lock:
            return self._frame, self._frame_id

    def release(self):
        self._running = False
        self._thread.join(timeout=3)
        self._cap.release()

# ─────────────────────────────────────────────────────────────────────────────
# WebSocket tasks
# ─────────────────────────────────────────────────────────────────────────────

async def receive_commands(ws, pool, ptz, token):
    """Handle inbound PTZ control messages."""
    try:
        async for raw in ws:
            try:
                msg = orjson.loads(raw)
            except orjson.JSONDecodeError:
                continue
            if msg.get("type") == "control":
                cmd = msg.get("command", "")
                print("ได้รับ: ", cmd)
                if not isinstance(cmd, dict):
                    continue

                ctrl_type = cmd.get("controlType")
                if ctrl_type in ("absolutely", "continuously"):
                    loop = asyncio.get_running_loop()
                    loop.run_in_executor(pool, ptz_worker, ptz, token, cmd)
                elif ctrl_type == "stream_settings":
                    apply_stream_settings(cmd)
                elif ctrl_type == "ai_toggle":
                    apply_ai_toggle(cmd)
                elif ctrl_type == "ai_settings":
                    apply_ai_settings(cmd)
    except websockets.exceptions.ConnectionClosed:
        pass


async def stream_frames(ws, reader: CameraReader, session, input_name, pool):
    """หยิบ frame ล่าสุดจาก reader → encode → ส่ง WebSocket"""
    loop          = asyncio.get_running_loop()
    frame_tick    = 1.0 / FPS
    frame_id      = 0
    last_dets     = None
    last_grabbed  = -1             # track ว่าเอา frame ไหนไปแล้ว

    print(f"Streaming → {SERVER_URI}")

    while True:
        t0 = time.monotonic()

        # หยิบ frame ล่าสุดจาก reader thread
        frame, fid = reader.grab()

        if frame is None or fid == last_grabbed:
            # ยังไม่มี frame ใหม่ → รอสั้นๆ แล้ว retry
            await asyncio.sleep(0.002)
            continue

        last_grabbed = fid

        # AI inference every FRAME_SKIP frames
        if AI_ENABLED:
            frame_id += 1
            if frame_id % FRAME_SKIP == 0:
                small = cv2.resize(frame, (INFER_W, INFER_H), interpolation=cv2.INTER_LINEAR)
                last_dets = await loop.run_in_executor(pool, run_inference, session, input_name, small)
                frame_id = 0
        else:
            # AI ปิดอยู่ → เคลียร์กรอบเก่าทิ้ง ไม่งั้นจะค้างส่งกรอบสุดท้ายไปเรื่อยๆ
            last_dets = None
            frame_id = 0

        # Encode output frame (ย้ายไป thread pool เพื่อไม่ block event loop)
        def _encode(f):
            out = cv2.resize(f, (OUT_W, OUT_H))
            _, buf = cv2.imencode(".jpg", out, [int(cv2.IMWRITE_JPEG_QUALITY), QUALITY])
            return buf.tobytes()

        jpg_bytes = await loop.run_in_executor(pool, _encode, frame)
        packet    = build_packet(last_dets, jpg_bytes)

        try:
            await ws.send(packet)
        except websockets.exceptions.ConnectionClosed:
            raise

        # Pace to target FPS
        elapsed = time.monotonic() - t0
        delay = frame_tick - elapsed
        if delay > 0:
            await asyncio.sleep(delay)

# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    if USE_RTSP:
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
            f"rtsp_transport;{'udp' if USE_UDP else 'tcp'}|"
            "fflags;nobuffer+discardcorrupt|"
            "flags;low_delay|"
            "max_delay;100000|"
            "reorder_queue_size;0|"
            "probesize;32768|"
            "analyzeduration;500000|"
            "err_detect;ignore_err"
        )
        source = RTSP_URL
        print(f"Source: RTSP → {CAMERA_IP}")
    else:
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = ""
        source = VIDEO_PATH
        print(f"Source: File → {VIDEO_PATH}")

    # Camera reader thread — อ่าน frame ตลอด เก็บแค่ตัวล่าสุด
    reader = CameraReader(source, is_rtsp=USE_RTSP)

    # Load and warm-up ONNX engine
    session    = load_session()
    input_name = session.get_inputs()[0].name
    session.run(None, {input_name: np.zeros((1, 3, INFER_H, INFER_W), dtype=np.float32)})
    print("ONNX engine ready")

    pool = ThreadPoolExecutor(max_workers=8)
    loop = asyncio.get_running_loop()

    # ── Sensor startup checks ────────────────────────────────────────────────
    gps_ok = await loop.run_in_executor(pool, check_gps)
    compass_ok = await loop.run_in_executor(pool, check_compass)

    if gps_ok:
        loop.run_in_executor(pool, gps_worker)
    else:
        print(
            f"GPS unavailable — using defaults: "
            f"lat={shared['latitude']}, lon={shared['longitude']}"
        )

    if compass_ok:
        loop.run_in_executor(pool, compass_worker)
    else:
        shared["heading"] = 0.0
        print(f"Compass unavailable — heading set to {shared['heading']}")

    ptz, ptz_token = init_ptz()

    if ptz is not None:
        print("Resetting camera to home position (pan=0, tilt=0)…")
        ptz_absolute_move(ptz, ptz_token, 0.0, 0.0)
        loop.run_in_executor(pool, ptz_status_worker, ptz, ptz_token)

    try:
        while True:
            try:
                print(f"Connecting to {SERVER_URI} …")
                async with websockets.connect(SERVER_URI) as ws:
                    print("Connected — Authenticating…")
                    
                    jwt_token = generate_camera_token()
                    await ws.send(orjson.dumps({
                        "type": "auth",
                        "token": jwt_token,
                        "metaData": {
                            "camera": {"camera_id": CAMERA_ID, "lat": shared["latitude"], "lon": shared["longitude"]},
                            "heading": {"installFace": shared["heading"], "currentPan": shared["current_pan"], "currentTilt": shared["current_tilt"]},
                            "controllable": PTZ_ENABLED
                        }
                    }))
                    
                    auth_reply = await ws.recv()
                    auth_msg = orjson.loads(auth_reply)
                    
                    if not (auth_msg.get("type") == "auth_response" and auth_msg.get("success")):
                        print(f"Authentication failed: {auth_msg}")
                        continue
                    
                    print("Authenticated — starting stream")
                    
                    await asyncio.gather(
                        stream_frames(ws, reader, session, input_name, pool),
                        receive_commands(ws, pool, ptz, ptz_token),
                    )
            except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError, OSError) as exc:
                print(f"Connection lost: {exc} — retrying in {RECONNECT_DELAY}s…")
                await asyncio.sleep(RECONNECT_DELAY)
    finally:
        reader.release()
        pool.shutdown(wait=False)
        print("Shutdown complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass