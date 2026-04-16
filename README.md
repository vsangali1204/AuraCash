# AuraCash 💰

Plataforma web de gestão financeira pessoal. Centralize contas bancárias, lançamentos, cartões de crédito e recorrências em um único lugar.

## O que faz

- **Dashboard** com resumo mensal de receitas, despesas e saldo
- **Contas bancárias** com saldo calculado automaticamente
- **Lançamentos** (débito, PIX, dinheiro, crédito, transferências)
- **Cartões de crédito** com controle de faturas e parcelamentos
- **Categorias** para organizar os gastos
- **Recorrências** para despesas e receitas fixas
- **A receber** para controlar valores emprestados

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Django 5 + Strawberry GraphQL
- **Banco de dados:** PostgreSQL
- **Auth:** JWT (access 15min / refresh 7 dias)

## Como rodar

```bash
# 1. Banco de dados
docker-compose up db -d

# 2. Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver

# 3. Frontend
cd frontend
npm install
npm run dev
```

Acesse em `http://localhost:5173`
