from flask import Flask, request, jsonify
import json
import os
from datetime import datetime, timedelta

app = Flask(__name__)

LOG_DIR = "workflow_logs"
EVENT_LOG = os.path.join(LOG_DIR, "events.json")
RISK_LOG = os.path.join(LOG_DIR, "risk.json")

os.makedirs(LOG_DIR, exist_ok=True)

# in-memory reminder scheduler (demo-safe)
reminder_schedule = {}


# ---------------------------
# Utility functions
# ---------------------------

def load_json(path):
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return []

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def log_event(event):
    logs = load_json(EVENT_LOG)
    logs.append(event)
    save_json(EVENT_LOG, logs)


# ---------------------------
# API ENDPOINTS
# ---------------------------

@app.route("/event", methods=["POST"])
def receive_event():
    """
    Receives forensic events from Node.js
    """
    event = request.json

    event_record = {
        "timestamp": datetime.utcnow().isoformat(),
        "event": event.get("event"),
        "evidenceId": event.get("evidenceId"),
        "metadata": event.get("metadata", {})
    }

    log_event(event_record)

    # auto-flag high-risk cases (demo logic)
    if event_record["metadata"].get("platform") in ["WhatsApp", "Telegram"]:
        mark_high_risk(event_record["evidenceId"], reason="Sensitive platform")

    return jsonify({"status": "event recorded"})


@app.route("/risk/<evidence_id>", methods=["POST"])
def manual_risk_flag(evidence_id):
    """
    Manually mark evidence as high risk
    """
    data = request.json or {}
    reason = data.get("reason", "Manual flag")

    mark_high_risk(evidence_id, reason)
    return jsonify({"status": "marked high risk"})


@app.route("/status", methods=["GET"])
def status():
    return jsonify({
        "service": "workflow",
        "events_logged": len(load_json(EVENT_LOG)),
        "high_risk_cases": len(load_json(RISK_LOG))
    })


# ---------------------------
# Risk & Reminder logic
# ---------------------------

def mark_high_risk(evidence_id, reason):
    risks = load_json(RISK_LOG)

    risk_entry = {
        "evidenceId": evidence_id,
        "reason": reason,
        "markedAt": datetime.utcnow().isoformat()
    }

    risks.append(risk_entry)
    save_json(RISK_LOG, risks)

    # schedule reminder (demo: 15 seconds)
    reminder_schedule[evidence_id] = datetime.utcnow() + timedelta(seconds=15)

    print(f"[ALERT] Evidence {evidence_id} marked HIGH RISK")


def check_reminders():
    now = datetime.utcnow()
    expired = []

    for evidence_id, remind_time in reminder_schedule.items():
        if now >= remind_time:
            print(f"[REMINDER] Evidence {evidence_id} requires attention")
            expired.append(evidence_id)

    for eid in expired:
        del reminder_schedule[eid]


# ---------------------------
# Background reminder loop
# ---------------------------

def reminder_loop():
    while True:
        check_reminders()
        import time
        time.sleep(5)


if __name__ == "__main__":
    from threading import Thread
    Thread(target=reminder_loop, daemon=True).start()
    app.run(port=8000)
