# Deploy mien phi bang Render - Huong A

Huong A dung:

- Frontend: Render Static Site.
- Backend: Render Web Service chay Docker.
- Database: Render Postgres.
- Cache/realtime phu tro: Render Key Value Redis-compatible.

Local Docker/MySQL van giu nguyen. Render se dung Postgres thong qua `DB_DRIVER=postgres` va `DATABASE_URL`.

## 1. Chuan bi repo

Can push code len GitHub truoc:

```bash
git status
git add .
git commit -m "Add Render deployment support"
git push origin main
```

## 2. Tao Blueprint tren Render

1. Vao Render Dashboard.
2. Chon **New > Blueprint**.
3. Connect GitHub repository cua project.
4. Render se doc file `render.yaml` o thu muc goc.
5. Khi Render hoi bien `VITE_API_BASE_URL`, tam thoi dien theo dang:

```text
https://<ten-backend-render>.onrender.com/api/v1
```

Vi du neu backend URL Render cap la:

```text
https://task-management-api.onrender.com
```

thi dien:

```text
https://task-management-api.onrender.com/api/v1
```

Neu chua biet URL backend luc tao lan dau, co the de tam mot gia tri, cho backend deploy xong roi sua lai env var cua frontend va redeploy frontend.

## 3. Render tu tao cac thanh phan

Blueprint se tao:

- `task-management-api`
- `task-management-frontend`
- `task-management-db`
- `task-management-redis`

Backend se tu chay:

```bash
./migrate -path migrations_postgres
```

truoc khi service duoc deploy. Bo migration nay nam trong `backend/migrations_postgres`.

## 4. Tao du lieu demo neu can

Sau khi backend deploy thanh cong, co the vao Shell cua service `task-management-api` tren Render va chay:

```bash
./seed
```

Tai khoan seed:

```text
admin@example.com / 123456
membera@example.com / 123456
memberb@example.com / 123456
```

Neu khong chay seed, ban co the dang ky user tu giao dien.

## 5. Kiem tra sau deploy

Mo backend health:

```text
https://<ten-backend-render>.onrender.com/health
```

Mo frontend:

```text
https://<ten-frontend-render>.onrender.com
```

Trong trang Cai dat cua frontend, kiem tra Backend API co dang:

```text
https://<ten-backend-render>.onrender.com/api/v1
```

## 6. Luu y goi free

Render free service co the sleep khi khong co traffic, nen lan dau mo lai se hoi cham. Neu Render thay doi chinh sach Postgres/Key Value free, ban can chon plan Render dang cho phep tai thoi diem deploy.
