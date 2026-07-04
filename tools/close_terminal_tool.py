#!/usr/bin/env python3
"""Close a read-only agent terminal tab and stop its process in Hermes Desktop.

Each ``terminal(background=true)`` process is mirrored as a read-only tab in the
desktop's terminal pane. In Desktop UX, closing that terminal means closing the
tab and stopping the background process behind it.

It routes through the process registry's ``on_close`` sink, which the desktop
gateway wires to emit a ``terminal.close`` event the renderer handles. Like
``read_terminal`` it is gated on ``HERMES_DESKTOP`` so it never appears outside
the GUI.
"""

import json
import os

from utils import env_var_enabled

from tools.process_registry import process_registry
from tools.registry import registry, tool_error


def close_terminal_tool(process_id: str) -> str:
    """Kill a background process and ask the desktop GUI to close its tab."""
    pid = (process_id or "").strip()
    if not pid:
        return tool_error("process_id is required (the background process whose terminal to close).")

    kill_result = process_registry.kill_process(pid, source="close_terminal")
    close_result = process_registry.request_close_terminal(pid)

    return json.dumps({"status": "ok", "closed": pid, "kill": kill_result, "tab": close_result}, ensure_ascii=False)


def check_close_terminal_requirements() -> bool:
    """Desktop GUI only — HERMES_DESKTOP is set on the gateway the app spawns."""
    return env_var_enabled("HERMES_DESKTOP")


CLOSE_TERMINAL_SCHEMA = {
    "name": "close_terminal",
    "description": (
        "Close one of your background terminals in the Hermes desktop GUI. This "
        "kills the background process started by terminal(background=true) and "
        "closes its mirrored terminal tab."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "process_id": {
                "type": "string",
                "description": (
                    "The background process's session id (from terminal(background=true) "
                    "output or process(action='list')) whose terminal should be closed."
                ),
            },
        },
        "required": ["process_id"],
    },
}


registry.register(
    name="close_terminal",
    toolset="terminal",
    schema=CLOSE_TERMINAL_SCHEMA,
    handler=lambda args, **kw: close_terminal_tool(process_id=args.get("process_id", "")),
    check_fn=check_close_terminal_requirements,
    emoji="🖥️",
)
