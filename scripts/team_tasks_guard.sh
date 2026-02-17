#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-/Users/shengchun.sun/.openclaw/workspace/data/team-tasks}"
MODE="${2:-check}" # check | fix

check_json() {
python3 - <<'PY'
import json,glob,os,sys
base=os.environ.get('BASE')
bad=[]
for p in glob.glob(base+"/*.json"):
    d=json.load(open(p))
    errs=[]
    if "project" not in d: errs.append("missing top-level: project")
    for sid,st in d.get("stages",{}).items():
        for k in ["agent","status","task","startedAt","completedAt","output","logs"]:
            if k not in st: errs.append(f"{sid} missing: {k}")
    if errs: bad.append((os.path.basename(p),errs))
if not bad:
    print("OK: 所有项目结构通过")
    sys.exit(0)
print("FOUND:")
for f,es in bad:
    print(f"- {f}")
    for e in es: print(f"  * {e}")
sys.exit(1)
PY
}

fix_json() {
python3 - <<'PY'
import json,glob,os
base=os.environ.get('BASE')
for p in glob.glob(base+"/*.json"):
    with open(p) as f:
        d=json.load(f)
    if "project" not in d and "name" in d:
        d["project"]=d["name"]
    for sid,st in d.get("stages",{}).items():
        st.setdefault("agent",sid)
        st.setdefault("status","pending")
        st.setdefault("task","")
        st.setdefault("startedAt",None)
        st.setdefault("completedAt",None)
        st.setdefault("output","")
        st.setdefault("logs",[])
    if d.get("currentStage") is None and d.get("status")=="active":
        for sid in d.get("pipeline",[]):
            if d["stages"].get(sid,{}).get("status") in ("pending","in-progress"):
                d["currentStage"]=sid
                break
    with open(p,"w") as f:
        json.dump(d,f,ensure_ascii=False,indent=2)
print("DONE: 已完成结构修复")
PY
}

export BASE

if [[ "$MODE" == "check" ]]; then
  check_json
elif [[ "$MODE" == "fix" ]]; then
  fix_json
  check_json
else
  echo "Usage: $0 [BASE_DIR] [check|fix]" >&2
  exit 2
fi
