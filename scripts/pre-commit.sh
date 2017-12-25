#!/usr/bin/env sh

scripts/check_merge_conflict.py `git diff --name-only --cached --diff-filter=d`
