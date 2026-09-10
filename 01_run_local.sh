#!/usr/bin/env bash
set -Eeuo pipefail

# b4-1 폴더를 로컬 웹 서버로 실행한다.
root_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
port=${1:-8000}

# 포트는 1부터 65535 사이의 정수만 허용한다.
if [[ ! $port =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
  echo "사용법: ./01_run_local.sh [1-65535 포트]" >&2
  exit 2
fi

# Python 기본 HTTP 서버는 별도 패키지 설치가 필요 없다.
command -v python3 >/dev/null 2>&1 || {
  echo "ERROR: python3가 필요합니다." >&2
  exit 1
}

echo "Portfolio: http://127.0.0.1:$port"
echo "Answer:    http://127.0.0.1:$port/README_answer.html"
echo "종료하려면 Ctrl-C를 누르세요."
exec python3 -m http.server "$port" --bind 127.0.0.1 --directory "$root_dir"
