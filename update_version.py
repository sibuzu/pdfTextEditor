import os
import re
from datetime import datetime

TEMPLATE_PATH = os.path.join("templates", "index.html")

def update_version():
    if not os.path.exists(TEMPLATE_PATH):
        print(f"Error: {TEMPLATE_PATH} not found.")
        return

    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Pattern: <span class="version-tag">...</span> (Matches any content inside)
    # flags=re.DOTALL to match newlines if any (though unlikely for a version tag)
    pattern = r'(<span class="version-tag">).*?(</span>)'
    
    # Check if tag exists
    if not re.search(pattern, content, flags=re.DOTALL):
        print("Error: <span class=\"version-tag\"> not found in index.html")
        return

    now = datetime.now()
    # Format: Ver. YYYY.MM.DD.HHMM
    version_str = f"Ver. {now.strftime('%Y.%m.%d.%H%M')}"
    
    # Replace content between tags
    new_content = re.sub(pattern, fr'\g<1>{version_str}\g<2>', content, flags=re.DOTALL)

    # Check if modification actually happened (to avoid 'updated' msg if same)
    # But for a simple script, just writing is fine. 
    # Let's see if content changed.
    if new_content == content:
         print(f"Version is already up to date.")
    else:
        with open(TEMPLATE_PATH, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated version to {version_str}")

if __name__ == "__main__":
    update_version()
