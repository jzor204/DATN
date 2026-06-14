# Deploy Task Management

Neu muon deploy mien phi bang Render voi Postgres/Key Value, xem them `DEPLOY_RENDER.md`.

Huong dan nay dung cho cach deploy don gian theo so do:

- React/Vite build thanh static files.
- Nginx phuc vu frontend va reverse proxy API/WebSocket.
- Backend Go/Fiber, MySQL va Redis chay bang Docker Compose.
- Co the chay bang IP VPS, khong bat buoc mua domain.

## 0. Deploy nhanh voi repo GitHub cua ban

Repo cua project:

```text
https://github.com/jzor204/DATN.git
```

Ban can co:

- 1 VPS Ubuntu co IP public.
- Tai khoan SSH vao VPS, vi du `root@<ip-vps>`.
- Docker va Docker Compose tren VPS.

Neu ban chua co VPS thi chua deploy public duoc. Khi do ban chi co the chay local bang Docker Desktop tren may Windows.

Quy trinh dung la:

1. Tren may Windows/local: push code moi nhat len GitHub.
2. SSH vao VPS Ubuntu.
3. Clone repo tu GitHub ve VPS.
4. Tao `.env.production`.
5. Build frontend.
6. Chay Docker Compose production.
7. Chay migration.
8. Mo `http://<ip-vps>/` de demo.

Neu local co thay doi chua push, chay tren PowerShell/local:

```bash
git status
git add .
git commit -m "Add production deployment setup"
git push origin main
```

Sau do SSH vao VPS:

```bash
ssh root@<ip-vps>
```

Tren VPS, clone repo:

```bash
git clone https://github.com/jzor204/DATN.git task-management
cd task-management
```

Tu day tro di, cac lenh Docker/Nginx/MySQL deu chay trong terminal VPS, khong chay trong PowerShell Windows.

## 1. Chuan bi VPS

Can mot VPS Ubuntu co Docker va Docker Compose plugin.

Tat ca lenh trong muc nay phai chay trong terminal cua VPS Ubuntu, khong chay trong PowerShell Windows. Neu ban dang o Windows, hay SSH vao VPS truoc:

```bash
ssh root@<ip-vps>
```

Hoac neu VPS dung user khac:

```bash
ssh <username>@<ip-vps>
```

Kiem tra:

```bash
docker --version
docker compose version
```

Neu chua co Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Dang xuat SSH roi dang nhap lai de user hien tai dung duoc Docker.

Mo firewall cong HTTP tren VPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable
```

Neu ban chi chay thu tren may Windows/local bang Docker Desktop, bo qua cac lenh `sudo ufw ...` vi day la firewall cua Ubuntu VPS.

Neu sau nay dung HTTPS/domain thi mo them cong 443:

```bash
sudo ufw allow 443/tcp
```

## 2. Dua source code len VPS

Cach pho bien nhat la clone repository:

```bash
git clone https://github.com/jzor204/DATN.git task-management
cd task-management
```

Neu chua dua repo len GitHub, co the copy thu muc project len VPS bang `scp` hoac cong cu upload cua VPS.

## 3. Tao file cau hinh production

Tao file `.env.production` tu file mau:

```bash
cp .env.production.example .env.production
nano .env.production
```

Sua cac gia tri quan trong:

```env
MYSQL_ROOT_PASSWORD=<mat-khau-root-mysql-manh>
MYSQL_PASSWORD=<mat-khau-user-mysql-manh>
JWT_SECRET=<chuoi-bi-mat-dai-va-ngau-nhien>
SWAGGER_HOST=<ip-vps-hoac-domain>
SWAGGER_SCHEMES=http
```

Vi du neu demo bang IP:

```env
SWAGGER_HOST=172.23.32.1
SWAGGER_SCHEMES=http
```

Khong commit file `.env.production` len Git.

## 4. Build frontend production

Frontend production se goi API qua cung domain voi Nginx bang `/api/v1`.

```bash
cd frontend
npm install
VITE_API_BASE_URL=/api/v1 npm run build
cd ..
```

Sau lenh nay, thu muc `frontend/dist` se duoc tao va Nginx se serve thu muc nay.

## 5. Khoi dong stack production

Tai thu muc goc project:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Kiem tra container:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Xem log backend:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
```

Xem log Nginx:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f nginx
```

## 6. Chay migration database

Backend hien tai khong tu dong chay migration, nen can import cac file SQL trong `backend/migrations`.

Sau khi MySQL container da healthy, chay:

```bash
cat backend/migrations/*.up.sql | docker compose --env-file .env.production -f docker-compose.prod.yml exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

Neu muon chay tung file de de theo doi loi, dung cach sau:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < backend/migrations/000001_create_users_table.up.sql
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < backend/migrations/000002_create_projects_table.up.sql
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < backend/migrations/000003_create_project_members_table.up.sql
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < backend/migrations/000004_create_tasks_table.up.sql
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < backend/migrations/000005_create_comments_table.up.sql
```

## 7. Tao seed data neu can

Neu muon co du lieu demo:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api go run ./cmd/seed
```

Neu image production khong co source sau khi ban toi uu Dockerfile ve sau, hay chay seed tu may local tro vao database VPS hoac them seed thanh binary rieng.

## 8. Kiem tra tren trinh duyet

Mo:

```text
http://<ip-vps>/
```

API health:

```text
http://<ip-vps>/health
```

Swagger:

```text
http://<ip-vps>/swagger/index.html
```

WebSocket duoc proxy qua:

```text
ws://<ip-vps>/api/v1/ws
```

Frontend tu dong tao WebSocket URL dua tren `VITE_API_BASE_URL=/api/v1`.

## 9. Cap nhat phien ban moi

Moi lan sua code va deploy lai:

```bash
git pull
cd frontend
npm install
VITE_API_BASE_URL=/api/v1 npm run build
cd ..
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Neu co migration moi, chay them migration moi truoc khi demo.

## 10. Dung domain va HTTPS neu can

Khong bat buoc mua domain cho do an. Demo bang IP la du.

Neu co domain, tro DNS A record ve IP VPS, sau do co the cau hinh Certbot/Nginx de dung HTTPS va WSS:

- UI: `https://your-domain`
- API: `https://your-domain/api/v1`
- WebSocket: `wss://your-domain/api/v1/ws`

Khi dung HTTPS, cap nhat `.env.production`:

```env
SWAGGER_HOST=your-domain
SWAGGER_SCHEMES=https
```

## 11. Lenh dung va xoa stack

Dung container:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

Dung va xoa ca volume database:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down -v
```

Can than voi lenh `down -v` vi no xoa du lieu MySQL va Redis.
