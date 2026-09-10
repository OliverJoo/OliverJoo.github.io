#!/usr/bin/env bash
set -Eeuo pipefail

# PDF 필수 파일, 코드 규칙, 질문 링크를 제출 전에 검사한다.
root_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
fail=0

# 프로젝트와 설명에 필요한 파일 목록이다.
required=(
  index.html css/style.css js/app.js images/profile.svg
  README.md README_answer.md README_answer.html
  01_run_local.sh
  02_portfolio-flow.mmd 02_portfolio-flow.svg 02_portfolio-flow.png 02_portfolio-flow.excalidraw
  03_diagram-viewer.html 04_verify_submission.sh
)

for file in "${required[@]}"; do
  if [[ ! -s "$root_dir/$file" ]]; then
    echo "MISSING: $file"
    fail=1
  fi
done

# 생성한 두 셸 스크립트의 Bash 문법을 확인한다.
bash -n "$root_dir/01_run_local.sh" || fail=1
bash -n "$root_dir/04_verify_submission.sh" || fail=1

# PDF가 금지한 인라인 이벤트, 인라인 스타일, var 사용을 차단한다.
if grep -Eq 'on(click|submit|input|scroll)=' "$root_dir/index.html"; then
  echo "INVALID: 인라인 이벤트 속성을 사용했습니다."
  fail=1
fi
if grep -Eq 'style=' "$root_dir/index.html"; then
  echo "INVALID: 인라인 스타일을 사용했습니다."
  fail=1
fi
if grep -Eq '(^|[^[:alnum:]_])var[[:space:]]+[[:alnum:]_$]+' "$root_dir/js/app.js"; then
  echo "INVALID: JavaScript var를 사용했습니다."
  fail=1
fi

# 브라우저 없이도 로컬 링크, 섹션, 평가 답변 수를 정확히 검사한다.
python3 - "$root_dir" <<'PY' || fail=1
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import re
import sys

root = Path(sys.argv[1]).resolve()
problems = []

class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.tags = set()
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag)
        values = dict(attrs)
        if values.get("id"):
            self.ids.add(values["id"])
        for key in ("href", "src"):
            if values.get(key):
                self.links.append(values[key])

def check_links(path):
    parser = Parser()
    parser.feed(path.read_text(encoding="utf-8"))
    for raw in parser.links:
        parsed = urlparse(raw)
        if parsed.scheme or raw.startswith(("mailto:", "data:")):
            continue
        if raw.startswith("#"):
            if raw[1:] and raw[1:] not in parser.ids:
                problems.append(f"{path.name}: 없는 id 링크 {raw}")
            continue
        target = (path.parent / parsed.path).resolve()
        if root not in target.parents and target != root:
            problems.append(f"{path.name}: 폴더 밖 링크 {raw}")
        elif not target.exists():
            problems.append(f"{path.name}: 없는 파일 링크 {raw}")
    return parser

# Markdown의 문서·코드·스크린샷 링크도 실제 파일과 대조한다.
def check_markdown(path):
    text = path.read_text(encoding="utf-8")
    for raw in re.findall(r"\[[^\]]*\]\(([^)]+)\)", text):
        parsed = urlparse(raw.split()[0])
        if parsed.scheme or raw.startswith(("#", "mailto:", "data:")):
            continue
        target = (path.parent / parsed.path).resolve()
        if root not in target.parents and target != root:
            problems.append(f"{path.name}: 폴더 밖 링크 {raw}")
        elif not target.exists():
            problems.append(f"{path.name}: 없는 파일 링크 {raw}")

portfolio = check_links(root / "index.html")
for expected in {"header", "nav", "main", "section", "article", "footer"} - portfolio.tags:
    problems.append(f"index.html: 시맨틱 태그 <{expected}> 누락")

for filename in ("README_answer.html", "03_diagram-viewer.html"):
    check_links(root / filename)

for filename in ("README.md", "README_answer.md"):
    check_markdown(root / filename)

markdown = (root / "README_answer.md").read_text(encoding="utf-8")
questions = len(re.findall(r"^### 질문 ", markdown, flags=re.M))
related = markdown.count("**관련 파일:**")
if (questions, related) != (15, 15):
    problems.append(f"README_answer.md: 질문={questions}, 관련 파일={related}, 기대값=15")

answer_html = (root / "README_answer.html").read_text(encoding="utf-8")
cards = answer_html.count('class="qcard"')
card_links = answer_html.count('class="related"')
if (cards, card_links) != (15, 15):
    problems.append(f"README_answer.html: 카드={cards}, 관련 링크={card_links}, 기대값=15")

if problems:
    print("CONTENT CHECK: FAIL")
    for problem in problems:
        print(f"  - {problem}")
    raise SystemExit(1)
print("CONTENT CHECK: PASS (15 Markdown answers, 15 HTML cards)")
PY

# JavaScript 구문은 Node.js가 설치된 환경에서 추가로 검사한다.
if command -v node >/dev/null 2>&1; then
  node --check "$root_dir/js/app.js" || fail=1
else
  echo "SKIP: node가 없어 JavaScript 구문 검사를 건너뜁니다."
fi

if (( fail )); then
  echo "FAIL: 제출 구성을 수정하세요."
  exit 1
fi
echo "PASS: 파일, Bash/JavaScript 문법, 시맨틱 구조, 로컬 링크가 일치합니다."
