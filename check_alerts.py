import json
import re

data = json.load(open('history.json'))
messages = data['messages']
pattern = re.compile(r'\[MONITOR\|RED\||\|RED\|')

for msg in messages:
    content = ""
    for part in msg['content']:
        if part['type'] == 'text':
            content += part['text']
    if pattern.search(content):
        print(f"Found match in message at {msg['timestamp']}:")
        print(content[:200])
        print("-" * 20)
