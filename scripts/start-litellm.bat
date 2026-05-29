@echo off
REM Start LiteLLM proxy (multi-model). Requires: pip install litellm, Ollama on :11434
litellm --config "%USERPROFILE%\litellm_config.yaml" --port 11435
