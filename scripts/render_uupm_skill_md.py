#!/usr/bin/env python3
"""
Render the SKILL.md for the ui-ux-pro-max skill by combining:
  - templates/platforms/universal.json  (platform config + frontmatter)
  - templates/base/skill-content.md     (body template)

This mirrors what the official `npx ui-ux-pro-max-cli init --ai universal` command does,
but is rerun in-place so we can install / upgrade the skill without network access.

Output path is hardcoded to the local skill dir at:
    /home/z/my-project/skills/ui-ux-pro-max/SKILL.md
"""

from __future__ import annotations
import json
import re
from pathlib import Path

SKILL_DIR = Path("/home/z/my-project/skills/ui-ux-pro-max")
PLATFORM_CONFIG = SKILL_DIR / "templates" / "platforms" / "universal.json"
BODY_TEMPLATE = SKILL_DIR / "templates" / "base" / "skill-content.md"
OUTPUT = SKILL_DIR / "SKILL.md"

# Our environment places the skill directly under <project>/skills/ui-ux-pro-max/
# (no `.agents/` prefix). So the canonical script path used in commands is:
SCRIPT_PATH = "skills/ui-ux-pro-max/scripts/search.py"


def render_frontmatter(frontmatter: dict[str, str] | None) -> str:
    if not frontmatter:
        return ""
    lines = ["---"]
    for key, value in frontmatter.items():
        if isinstance(value, str) and (":" in value or '"' in value or "\n" in value):
            escaped = value.replace("\\", "\\\\").replace('"', '\\"')
            lines.append(f'{key}: "{escaped}"')
        else:
            lines.append(f"{key}: {value}")
    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    config = json.loads(PLATFORM_CONFIG.read_text(encoding="utf-8"))
    body = BODY_TEMPLATE.read_text(encoding="utf-8")

    # universal.json sets sections.quickReference = false, so quickRef is empty
    quick_ref = ""

    rendered = body
    rendered = rendered.replace("{{TITLE}}", config["title"])
    rendered = rendered.replace("{{DESCRIPTION}}", config["description"])
    rendered = rendered.replace("{{SCRIPT_PATH}}", SCRIPT_PATH)
    rendered = rendered.replace("{{SKILL_OR_WORKFLOW}}", config.get("skillOrWorkflow", "Skill"))
    rendered = rendered.replace("{{QUICK_REFERENCE}}", quick_ref)

    # Collapse any accidental 3+ blank lines down to a single blank line
    rendered = re.sub(r"\n{3,}", "\n\n", rendered)

    frontmatter = render_frontmatter(config.get("frontmatter"))
    final = frontmatter + rendered.rstrip() + "\n"

    OUTPUT.write_text(final, encoding="utf-8")
    print(f"Wrote {OUTPUT}  ({len(final)} bytes, {final.count(chr(10))} lines)")


if __name__ == "__main__":
    main()
