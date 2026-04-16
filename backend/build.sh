#!/usr/bin/env bash
# Script de build executado pelo Render a cada deploy

set -o errexit  # Aborta se qualquer comando falhar

pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate
