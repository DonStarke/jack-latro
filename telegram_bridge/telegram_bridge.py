import asyncio
import json
import logging
import os
import subprocess
import sys
from pathlib import Path

from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.error import BadRequest, InvalidToken
from telegram.request import HTTPXRequest
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from google.antigravity import Agent, CapabilitiesConfig, LocalAgentConfig
from google.antigravity.hooks import policy

# Logging setup
logging.basicConfig(
    format="%(asctime)s - [%(levelname)s] - %(message)s",
    level=logging.INFO,
)
# Silence verbose HTTP polling logs from Telegram client
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger("AntigravityTelegramBridge")

CONFIG_PATH = Path(__file__).parent / "bridge_config.json"


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        logger.error(f"Configuration file not found at {CONFIG_PATH}")
        sys.exit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_config(config_data: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=2)
    logger.info(f"Updated configuration saved to {CONFIG_PATH}")


class AgentManager:
    def __init__(self, config: dict):
        self.config = config
        self.agent: Agent | None = None
        self.lock = asyncio.Lock()
        self.is_busy = False

    def _build_agent_config(self) -> LocalAgentConfig:
        workspace = self.config.get("workspace_path") or os.getcwd()
        api_key = self.config.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")

        if not api_key:
            raise ValueError(
                "Gemini API key is missing! Please add 'gemini_api_key' to bridge_config.json "
                "or set the GEMINI_API_KEY environment variable. Get a free key at https://aistudio.google.com/apikey"
            )

        policies = [policy.allow_all()] if self.config.get("auto_approve", True) else None

        return LocalAgentConfig(
            system_instructions=(
                "You are an expert autonomous pair programmer assisting the user remotely. "
                "You have full capabilities to run workspace terminal commands, read files, and write code. "
                "Keep responses concise, informative, and formatted in clean markdown. "
                "When completing a coding task, summarize what you verified or tested."
            ),
            workspaces=[workspace],
            capabilities=CapabilitiesConfig(),
            policies=policies,
            api_key=api_key,
        )

    async def start(self) -> None:
        await self.stop()
        agent_config = self._build_agent_config()
        self.agent = Agent(agent_config)
        await self.agent.__aenter__()
        logger.info(f"Agent session started (ID: {self.agent.conversation_id})")

    async def stop(self) -> None:
        if self.agent is not None:
            try:
                await self.agent.__aexit__(None, None, None)
                logger.info("Previous agent session closed.")
            except Exception as e:
                logger.warning(f"Error closing agent session: {e}")
            finally:
                self.agent = None

    async def reset(self) -> str:
        async with self.lock:
            await self.start()
            workspace = self.config.get("workspace_path", os.getcwd())
            return (
                "🧹 *New conversation started!*\n"
                f"• *Workspace:* `{workspace}`\n"
                "• *Memory:* Cleared\n\n"
                "Ready for your next prompt."
            )

    async def execute_prompt(self, prompt: str, update: Update, context: ContextTypes.DEFAULT_TYPE) -> str:
        async with self.lock:
            self.is_busy = True
            try:
                if self.agent is None:
                    await self.start()

                # Start periodic typing indicator
                keep_typing = True

                async def keep_typing_loop():
                    while keep_typing:
                        try:
                            await context.bot.send_chat_action(
                                chat_id=update.effective_chat.id,
                                action=ChatAction.TYPING,
                            )
                        except Exception:
                            pass
                        await asyncio.sleep(4)

                typing_task = asyncio.create_task(keep_typing_loop())

                try:
                    response = await self.agent.chat(prompt)
                    result_text = await response.text()
                finally:
                    keep_typing = False
                    typing_task.cancel()

                return result_text or "*(Task completed with no text output)*"
            finally:
                self.is_busy = False


async def send_split_message(update: Update, text: str) -> None:
    """Sends long text safely split into chunks under Telegram's 4096 character limit."""
    max_len = 3800
    if len(text) <= max_len:
        chunks = [text]
    else:
        # Split on line breaks where possible
        chunks = []
        current_chunk = []
        current_len = 0
        for line in text.splitlines(keepends=True):
            if current_len + len(line) > max_len:
                chunks.append("".join(current_chunk))
                current_chunk = [line]
                current_len = len(line)
            else:
                current_chunk.append(line)
                current_len += len(line)
        if current_chunk:
            chunks.append("".join(current_chunk))

    for chunk in chunks:
        if not chunk.strip():
            continue
        try:
            await update.message.reply_text(chunk, parse_mode=ParseMode.MARKDOWN)
        except BadRequest:
            # Fallback to plain text if Markdown has mismatched syntax
            await update.message.reply_text(chunk)


async def check_auth(update: Update, config: dict) -> bool:
    """Verifies that the incoming message is from the authorized user or pairs on first contact."""
    user = update.effective_user
    if not user:
        return False

    auth_id = config.get("telegram_user_id")

    # First-time auto-pairing mode
    if auth_id is None:
        config["telegram_user_id"] = user.id
        save_config(config)
        welcome_msg = (
            f"🎉 *Successfully paired with your Telegram account!*\n\n"
            f"• *User ID:* `{user.id}`\n"
            f"• *Name:* {user.full_name}\n\n"
            "From now on, this bot will only accept commands from you.\n"
            "Type `/help` to see available commands or simply send a prompt to begin."
        )
        await update.message.reply_text(welcome_msg, parse_mode=ParseMode.MARKDOWN)
        return True

    if user.id != auth_id:
        logger.warning(f"Ignored unauthorized message from user ID: {user.id} ({user.username})")
        return False

    return True


def get_git_status(workspace: str) -> str:
    try:
        branch = subprocess.check_output(
            ["git", "branch", "--show-current"],
            cwd=workspace,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        status = subprocess.check_output(
            ["git", "status", "--short"],
            cwd=workspace,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        diff_count = len(status.splitlines()) if status else 0
        return f"Branch: `{branch}` | Modified files: `{diff_count}`"
    except Exception:
        return "Git status unavailable"


def create_app(config: dict, agent_mgr: AgentManager):
    bot_token = config.get("telegram_bot_token", "").strip()
    if not bot_token:
        print("\n" + "=" * 60)
        print("ERROR: 'telegram_bot_token' is empty in bridge_config.json!")
        print("Please paste the token you received from @BotFather into bridge_config.json")
        print("=" * 60 + "\n")
        sys.exit(1)

    # Use generous network timeouts to prevent handshake timeouts
    request_client = HTTPXRequest(
        connect_timeout=30.0,
        read_timeout=30.0,
        write_timeout=30.0,
        pool_timeout=10.0,
    )

    app = ApplicationBuilder().token(bot_token).request(request_client).build()

    async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not await check_auth(update, config):
            return
        help_text = (
            "🤖 *Antigravity Telegram Bridge Active*\n\n"
            "You can send prompts directly as text messages.\n\n"
            "*Commands:*\n"
            "• `/new` or `/reset` - Start a fresh conversation (wipes context)\n"
            "• `/status` - Check active workspace, git branch, and agent status\n"
            "• `/help` - Show this help message"
        )
        await update.message.reply_text(help_text, parse_mode=ParseMode.MARKDOWN)

    async def new_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not await check_auth(update, config):
            return
        status_msg = await update.message.reply_text("🔄 Resetting agent session...")
        try:
            msg = await agent_mgr.reset()
            await status_msg.edit_text(msg, parse_mode=ParseMode.MARKDOWN)
        except Exception as e:
            await status_msg.edit_text(f"❌ Failed to reset session: {e}")

    async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not await check_auth(update, config):
            return
        ws = config.get("workspace_path", os.getcwd())
        git_info = get_git_status(ws)
        busy_str = "⏳ Working on a task" if agent_mgr.is_busy else "🟢 Idle and ready"
        status_text = (
            "📊 *System Status*\n\n"
            f"• *Status:* {busy_str}\n"
            f"• *Workspace:* `{ws}`\n"
            f"• *Git:* {git_info}\n"
            f"• *Auto-Approve:* `{'Enabled' if config.get('auto_approve', True) else 'Disabled'}`\n"
        )
        await update.message.reply_text(status_text, parse_mode=ParseMode.MARKDOWN)

    async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not await check_auth(update, config):
            return

        prompt = update.message.text
        if not prompt:
            return

        if agent_mgr.is_busy:
            await update.message.reply_text("⏳ Agent is currently busy working on the previous task. Please wait.")
            return

        status_msg = await update.message.reply_text("🤔 *Agent thinking & executing...*", parse_mode=ParseMode.MARKDOWN)

        try:
            response_text = await agent_mgr.execute_prompt(prompt, update, context)
            try:
                await status_msg.delete()
            except Exception:
                pass
            await send_split_message(update, response_text)
        except Exception as e:
            logger.error(f"Error during agent execution: {e}", exc_info=True)
            await status_msg.edit_text(f"❌ *Error executing request:*\n`{e}`", parse_mode=ParseMode.MARKDOWN)

    app.add_handler(CommandHandler("start", start_cmd))
    app.add_handler(CommandHandler("help", start_cmd))
    app.add_handler(CommandHandler("new", new_cmd))
    app.add_handler(CommandHandler("reset", new_cmd))
    app.add_handler(CommandHandler("status", status_cmd))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    return app


def main():
    config = load_config()
    agent_mgr = AgentManager(config)

    print("\n" + "=" * 60)
    print("      🚀 Antigravity Telegram Bridge Initializing")
    print("=" * 60)
    print(f"Workspace : {config.get('workspace_path')}")
    print(f"User ID   : {config.get('telegram_user_id') or '[Waiting for first message to pair]'}")
    print("=" * 60 + "\n")

    app = create_app(config, agent_mgr)
    print("Connecting to Telegram... Press Ctrl+C to stop.\n")
    try:
        app.run_polling(bootstrap_retries=5)
    except InvalidToken:
        print("\n" + "!" * 60)
        print("❌ ERROR: Telegram rejected your bot token as Unauthorized (401)!")
        print("Please check your token:")
        print("1. Open Telegram and go to @BotFather")
        print("2. Send /mybots and select your bot")
        print("3. Tap 'API Token' and copy the token")
        print("4. Paste it carefully into bridge_config.json")
        print("!" * 60 + "\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
