#!/usr/bin/env bash
# Sets up the local Python environment and Whisper model for video highlight distillation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${PWD}"
VENV_DIR="${ROOT_DIR}/.venv"
MODEL_DIR="${ROOT_DIR}/models/whisper-large-v3-turbo-q4"
REQUIRED_MODEL_FILES=(
  "${MODEL_DIR}/config.json"
  "${MODEL_DIR}/weights.npz"
)

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but was not found on PATH." >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required but was not found on PATH." >&2
  echo "Install it first, for example with Homebrew: brew install ffmpeg" >&2
  exit 1
fi

if ! command -v ffprobe >/dev/null 2>&1; then
  echo "ffprobe is required but was not found on PATH." >&2
  echo "Install it first, for example with Homebrew: brew install ffmpeg" >&2
  exit 1
fi

if [[ ! -d "${VENV_DIR}" ]]; then
  python3 -m venv "${VENV_DIR}"
fi

"${VENV_DIR}/bin/python" -m pip install --upgrade pip

if ! "${VENV_DIR}/bin/python" -c "import importlib.util; assert importlib.util.find_spec('huggingface_hub'); assert importlib.util.find_spec('mlx_whisper')" >/dev/null 2>&1; then
  "${VENV_DIR}/bin/pip" install \
    huggingface_hub \
    mlx-whisper
else
  echo "Python dependencies already available in ${VENV_DIR}."
fi

model_ready=true
for required_file in "${REQUIRED_MODEL_FILES[@]}"; do
  if [[ ! -f "${required_file}" ]]; then
    model_ready=false
    break
  fi
done

if [[ "${model_ready}" == "false" ]]; then
  "${VENV_DIR}/bin/python" \
    "${SCRIPT_DIR}/download_model.py" \
    --repo mlx-community/whisper-large-v3-turbo-q4 \
    --output-dir "${MODEL_DIR}"
else
  echo "Model already present at ${MODEL_DIR}."
fi

echo "Setup complete."
echo "Virtual environment: ${VENV_DIR}"
echo "Model path: ${MODEL_DIR}"
