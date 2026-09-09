# Panduan Lengkap Setup & Penggunaan Enterprise SSO Management

Dokumen ini berisi instruksi lengkap untuk melakukan setup, konfigurasi, dan penggunaan aplikasi **Enterprise SSO Management Platform**. Aplikasi ini dirancang menggunakan arsitektur Monorepo yang terdiri dari Backend (Node.js/Express) dan Frontend (React).

---

## 1. Prasyarat Sistem (Prerequisites)

Sebelum menjalankan aplikasi, pastikan sistem Anda sudah terinstal:
- **Node.js**: Minimal versi 18.x.x
- **NPM**: Minimal versi 9.x.x
- **MS SQL Server**: Untuk menyimpan data (Database utama).
- **Redis (Opsional tapi Direkomendasikan)**: Digunakan untuk session caching dan rate-limiting (aplikasi tetap bisa berjalan walau Redis mati).
- **Git** (Opsional)

---

## 2. Instalasi & Persiapan Database

### A. Membuat Database di SQL Server
1. Buka SQL Server Management Studio (SSMS).
2. Buat database baru bernama `SSO_PPT`.
3. Buat SQL Server Authentication Login:
   - **Username**: `PEPITO_SSO`
   - **Password**: `PEPITO_SSO`
   - Pastikan user ini memiliki akses `db_owner` terhadap database `SSO_PPT`.
4. Pastikan fitur **TCP/IP** dihidupkan melalui *SQL Server Configuration Manager* (default port 1433).

### B. Install Dependencies Aplikasi
Buka terminal/Command Prompt, arahkan ke folder root proyek (`f:\SSOPPT`), lalu jalankan:
```bash
# Jika ada script postinstall di root:
npm install

# Atau install manual di tiap folder:
cd backend && npm install
cd ../frontend && npm install
```

---

## 3. Konfigurasi Environment Variables

Buka folder `backend` dan pastikan file `.env.development` sudah dikonfigurasi sesuai dengan pengaturan server Anda.

**Contoh isi `backend/.env.development`:**
```ini
# Development Environment Configuration
NODE_ENV=development
PORT=3003

# Database Configuration
DB_HOST=localhost
DB_PORT=1433
DB_NAME=SSO_PPT
DB_USER=PEPITO_SSO
DB_PASSWORD=PEPITO_SSO
DB_SSL=false

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT & Session
JWT_SECRET=dev-jwt-secret-key-for-development-only
SESSION_SECRET=dev-session-secret-for-development-only
```
*(Catatan: Anda dapat menyalin file ini menjadi `.env.production` atau sekadar `.env` apabila akan di-deploy ke production).*

---

## 4. Inisialisasi Tabel (Database Migrations)

Setelah koneksi ke DB berhasil diatur, Anda wajib menjalankan skrip inisialisasi agar tabel-tabel seperti `users`, `roles`, `user_roles`, dan `clients` terbuat.

Jalankan perintah berikut di dalam folder **`backend`**:
```bash
cd backend
npm run migrate:up
```
*(Apabila perintah di atas belum diset secara penuh, jalankan script setup spesifik yang tersedia seperti `ts-node src/scripts/setup-db.ts` atau `setup-enterprise-features.ts`).*

---

## 5. Menjalankan Aplikasi (Development)

Proyek ini telah dikonfigurasi menggunakan `concurrently` di root untuk menjalankan Backend dan Frontend secara bersamaan.

Dari folder root (`f:\SSOPPT`), jalankan:
```bash
npm run dev
```

Ini akan secara otomatis memicu:
- **Backend**: Berjalan di `http://localhost:3003`
- **Frontend**: Berjalan di `http://localhost:3000`

Jika berhasil, Anda bisa membuka browser dan mengakses `http://localhost:3000`.

---

## 6. Penjelasan Menu & Cara Penggunaan Frontend (UI)

Setelah Anda membuka aplikasi di browser (`http://localhost:3000`), Anda akan melihat bilah navigasi di sebelah kiri. Berikut adalah rincian setiap menu dan cara menggunakannya:

### A. Dashboard (`/`)
- **Fungsi:** Halaman utama yang memberikan ringkasan (summary) sistem.
- **Cara Pakai:** Anda bisa melihat metrik dasar terkait sistem SSO. Halaman ini ideal untuk mendapatkan gambaran singkat aktivitas login.

### B. Identity Management (`/users`)
- **Fungsi:** Pusat pengaturan semua pengguna (User) di dalam ekosistem SSO.
- **Cara Pakai:**
  - **Melihat Daftar User:** Anda akan melihat tabel berisi seluruh data user beserta status mereka (Active/Disabled).
  - **Menambah User Baru:** Klik tombol **"Add New User"**. Isi data dasar seperti Nama Depan, Nama Belakang, Email, Username, dan **Password**. Anda juga bisa menetapkan *Roles* dan mencentang opsi *"Force password change on next login"*.
  - **Mengedit User:** Klik baris/nama user pada tabel. Di halaman Edit, Anda dapat mengubah informasi profil. Khusus pengisian *Password* pada mode Edit bersifat **opsional** (biarkan kosong jika tidak ingin mengubah password lama pengguna).

### C. Roles & Permissions (`/roles`)
- **Fungsi:** Mengatur hak akses dan kelompok otoritas. Sistem ini mendukung *Role-Based Access Control* (RBAC).
- **Cara Pakai:** 
  - Anda dapat mendefinisikan Role baru (contoh: `SuperAdmin`, `AppManager`, `Helpdesk`) atau mengedit Role yang sudah ada. 
  - Role ini nantinya akan di-assign ke masing-masing pengguna di menu *Identity Management*. Satu user dapat diberikan lebih dari satu Role.

### D. Client Applications (`/clients`)
- **Fungsi:** Tempat mendaftarkan aplikasi-aplikasi internal maupun eksternal yang menggunakan layanan SSO ini.
- **Cara Pakai:** 
  - Anda menambahkan aplikasi (client) baru untuk mendapatkan `Client ID` dan `Client Secret`.
  - Masukkan detail seperti *Redirect URIs* dan tipe aplikasi (Web, SPA, Mobile). Pengaturan di sini penting agar aplikasi tersebut diizinkan berinteraksi dengan *Authorization Server* (OIDC/OAuth2) kita.

### E. Identity Providers (`/providers`)
- **Fungsi:** Mengatur integrasi dengan penyedia identitas eksternal (IdP) seperti Google, Microsoft Entra ID (Azure AD), LDAP/Active Directory, atau SAML 2.0.
- **Cara Pakai:**
  - Jika Anda ingin user bisa login menggunakan akun Google atau LDAP perusahaan, konfigurasikan *Client ID* dan *Secret* dari penyedia tersebut di menu ini.

### F. Audit Logs (`/audit`)
- **Fungsi:** Log jejak audit (Audit Trail) dari seluruh aktivitas keamanan sistem.
- **Cara Pakai:**
  - Anda bisa memantau dan melacak semua tindakan krusial seperti siapa yang membuat user, login sukses/gagal, penggantian password, hingga percobaan eksploitasi (*Account Lockout*). Fitur ini sangat penting untuk pelacakan dan kepatuhan (Compliance).

---

## 7. Troubleshooting Umum (Tanya-Jawab)

1. **Kenapa saat dijalankan ada pesan *Redis client error*?**
   - Aplikasi mencoba mendeteksi Redis untuk sistem *caching*. Jika Redis tidak terinstal, sistem akan memunculkan pesan error/warning tersebut tetapi **aplikasi akan tetap berjalan normal** tanpa *cache* (fallback mode).
2. **Error "Failed to connect to SQL Server" di backend?**
   - Pastikan service *SQL Server (MSSQLSERVER)* atau *(SQLEXPRESS)* berjalan di `services.msc`.
   - Pastikan *TCP/IP* diaktifkan di SQL Server Configuration Manager (Restart service SQL Server setelah mengubahnya).
   - Pastikan password `PEPITO_SSO` benar.
3. **Form User tidak bisa menyimpan (Tidak ada respon)?**
   - Buka Console (F12) di browser, dan periksa terminal backend Anda. Pastikan semua *field mandatory* seperti Nama Depan dan Nama Belakang sudah diisi. Jika input berupa "Date" / Tanggal kosong, sistem secara otomatis merubahnya menjadi `NULL` yang diterima secara valid oleh SQL Server.

---


