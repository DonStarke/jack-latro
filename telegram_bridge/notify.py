import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

CONFIG_PATH = Path(__file__).parent / "bridge_config.json"


def send_telegram(text: str) -> bool:
    if not CONFIG_PATH.exists():
        print(f"Error: Config not found at {CONFIG_PATH}")
        return False

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    token = config.get("telegram_bot_token")
    user_id = config.get("telegram_user_id")

    if not token or not user_id:
        print("Error: Missing token or user_id in bridge_config.json")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    # Split message into chunks under Telegram's 4096 limit
    max_len = 3800
    chunks = [text[i : i + max_len] for i in range(0, len(text), max_len)] or [text]

    for chunk in chunks:
        data = urllib.parse.urlencode(
            {
                "chat_id": user_id,
                "text": chunk,
                "parse_mode": "Markdown",
            }
        ).encode("utf-8")

        req = urllib.request.Request(url, data=data)
        try:
            with urllib.request.urlopen(req) as resp:
                pass
        except urllib.error.HTTPError:
            # Fallback to plain text if Markdown parsing failed
            data = urllib.parse.urlencode({"chat_id": user_id, "text": chunk}).encode("utf-8")
            req = urllib.request.Request(url, data=data)
            try:
                with urllib.request.urlopen(req) as resp:
                    pass
            except Exception as e:
                print(f"Failed to send chunk: {e}")
                return False
        except Exception as e:
            print(f"Error sending message: {e}")
            return False

    print("Notification sent successfully!")
    return True


if __name__ == "__main__":
    if len(sys.argv) > 1:
        message = " ".join(sys.argv[1:])
    else:
        message = sys.stdin.read().strip()

    if not message:
        print("Usage: python notify.py 'Your message here'")
        sys.exit(1)

    send_telegram(message)
